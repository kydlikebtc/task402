/**
 * EIP-3009 签名验证服务
 */

import { ethers } from 'ethers';
import { EIP3009Signature } from '../types';

/**
 * 验证 EIP-3009 签名
 */
export async function verifyEIP3009Signature(
  usdcAddress: string,
  chainId: number,
  from: string,
  to: string,
  value: bigint,
  signature: EIP3009Signature,
  provider: ethers.Provider
): Promise<{ valid: boolean; error?: string }> {
  try {
    // 1. 验证时间窗口
    const now = Math.floor(Date.now() / 1000);
    
    if (now < signature.validAfter) {
      return { valid: false, error: 'Signature not yet valid' };
    }
    
    if (now >= signature.validBefore) {
      return { valid: false, error: 'Signature expired' };
    }
    
    // 2. 检查 nonce 是否已使用
    const usdc = new ethers.Contract(
      usdcAddress,
      [
        'function authorizationState(address authorizer, bytes32 nonce) view returns (bool)',
      ],
      provider
    );
    
    const nonceUsed = await usdc.authorizationState(from, signature.nonce);
    
    if (nonceUsed) {
      return { valid: false, error: 'Nonce already used' };
    }
    
    // 3. 构建 EIP-712 类型化数据
    const domain = {
      name: 'USD Coin',
      version: '1',
      chainId: chainId,
      verifyingContract: usdcAddress,
    };
    
    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    };
    
    const message = {
      from,
      to,
      value: value.toString(),
      validAfter: signature.validAfter,
      validBefore: signature.validBefore,
      nonce: signature.nonce,
    };
    
    // 4. 计算 EIP-712 哈希
    const digest = ethers.TypedDataEncoder.hash(domain, types, message);
    
    // 5. 恢复签名者
    const recoveredAddress = ethers.recoverAddress(digest, {
      v: signature.v,
      r: signature.r,
      s: signature.s,
    });
    
    // 6. 验证签名者是否为 from 地址
    if (recoveredAddress.toLowerCase() !== from.toLowerCase()) {
      return { valid: false, error: `Invalid signature: expected ${from}, got ${recoveredAddress}` };
    }
    
    return { valid: true };
    
  } catch (error: any) {
    return { valid: false, error: `Verification failed: ${error.message}` };
  }
}

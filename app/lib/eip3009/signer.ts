/**
 * EIP-3009 签名工具（前端版本）
 */

import { ethers } from 'ethers';

export interface EIP3009Signature {
  v: number;
  r: string;
  s: string;
  nonce: string;
  validAfter: number;
  validBefore: number;
}

/**
 * 生成唯一 nonce
 */
export function generateNonce(): string {
  return ethers.hexlify(ethers.randomBytes(32));
}

/**
 * 创建 EIP-3009 签名
 */
export async function createEIP3009Authorization(
  signer: ethers.Signer,
  usdcAddress: string,
  chainId: number,
  to: string,
  value: bigint,
  validUntilTimestamp?: number
): Promise<EIP3009Signature> {
  const from = await signer.getAddress();
  const nonce = generateNonce();
  const validAfter = 0; // 立即生效
  const validBefore = validUntilTimestamp || Math.floor(Date.now() / 1000) + 3600; // 默认 1 小时

  // EIP-712 Domain
  const domain = {
    name: 'USD Coin',
    version: '1',
    chainId: chainId,
    verifyingContract: usdcAddress,
  };

  // EIP-712 Types
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

  // Message
  const message = {
    from,
    to,
    value: value.toString(),
    validAfter,
    validBefore,
    nonce,
  };

  // 签名
  const signature = await signer.signTypedData(domain, types, message);

  // 分解签名
  const sig = ethers.Signature.from(signature);

  return {
    v: sig.v,
    r: sig.r,
    s: sig.s,
    nonce,
    validAfter,
    validBefore,
  };
}

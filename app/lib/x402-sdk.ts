/**
 * X402 Client SDK (TypeScript 版本)
 *
 * 提供 EIP-3009 签名生成工具
 */

import { ethers } from 'ethers';

export interface EIP3009SignatureParams {
  usdcAddress: string;
  from: string;
  to: string;
  value: bigint | string;
  validAfter: number;
  validBefore: number;
  nonce: string;
  signer: ethers.Signer;
  chainId: number;
  usdcName?: string;
  usdcVersion?: string;
}

export interface EIP3009Signature {
  v: number;
  r: string;
  s: string;
  signature: string;
}

/**
 * 生成 EIP-3009 TransferWithAuthorization 签名
 */
export async function generateEIP3009Signature({
  usdcAddress,
  from,
  to,
  value,
  validAfter,
  validBefore,
  nonce,
  signer,
  chainId,
  usdcName = 'USD Coin',
  usdcVersion = '2'
}: EIP3009SignatureParams): Promise<EIP3009Signature> {
  // EIP-712 Domain
  const domain = {
    name: usdcName,
    version: usdcVersion,
    chainId: chainId,
    verifyingContract: usdcAddress
  };

  // EIP-712 Types
  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' }
    ]
  };

  // Value
  const valueData = {
    from,
    to,
    value: value.toString(),
    validAfter,
    validBefore,
    nonce
  };

  // 生成签名
  const signature = await signer.signTypedData(domain, types, valueData);

  // 分解签名
  const { v, r, s } = ethers.Signature.from(signature);

  return { v, r, s, signature };
}

/**
 * 生成随机 nonce
 */
export function generateNonce(): string {
  return ethers.hexlify(ethers.randomBytes(32));
}

export interface CreateX402PaymentParams {
  facilitatorUrl: string;
  taskRegistryAddress: string;
  escrowAddress: string;
  usdcAddress: string;
  description: string;
  reward: bigint;
  deadline: number;
  category: number;
  signer: ethers.Signer;
  chainId: number;
}

export interface CreateX402PaymentResult {
  txHash: string;
  taskId: number;
  blockNumber: number;
  gasUsed: string;
}

/**
 * 创建 USDC 任务 (使用 X402 协议)
 */
export async function createTaskWithUSDC({
  facilitatorUrl,
  taskRegistryAddress,
  escrowAddress,
  usdcAddress,
  description,
  reward,
  deadline,
  category,
  signer,
  chainId
}: CreateX402PaymentParams): Promise<CreateX402PaymentResult> {
  // 生成 nonce
  const nonce = generateNonce();

  // 设置有效期 (1小时)
  const validAfter = 0;
  const validBefore = Math.floor(Date.now() / 1000) + 3600;

  // 生成 EIP-3009 签名
  const { v, r, s } = await generateEIP3009Signature({
    usdcAddress,
    from: await signer.getAddress(),
    to: escrowAddress,  // 转给 Escrow
    value: reward,
    validAfter,
    validBefore,
    nonce,
    signer,
    chainId,
    usdcVersion: '1'  // MockUSDC 使用 version "1"
  });

  // 调用 Facilitator API
  const response = await fetch(`${facilitatorUrl}/createTask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      taskRegistryAddress,
      creator: await signer.getAddress(),
      description,
      reward: reward.toString(),
      deadline,
      category,
      validAfter,
      validBefore,
      nonce,
      v, r, s
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Facilitator error: ${error.error || 'Unknown error'}`);
  }

  const result = await response.json();

  return {
    txHash: result.txHash,
    taskId: result.taskId,
    blockNumber: result.blockNumber,
    gasUsed: result.gasUsed
  };
}

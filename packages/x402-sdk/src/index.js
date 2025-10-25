/**
 * X402 Client SDK
 * 
 * 提供 EIP-3009 签名生成工具
 */

import { ethers } from 'ethers';

/**
 * 生成 EIP-3009 TransferWithAuthorization 签名
 * 
 * @param {object} params - 签名参数
 * @param {string} params.usdcAddress - USDC 合约地址
 * @param {string} params.from - 付款方地址
 * @param {string} params.to - 收款方地址
 * @param {string|BigInt} params.value - 转账金额
 * @param {number} params.validAfter - 有效起始时间 (unix timestamp)
 * @param {number} params.validBefore - 有效截止时间 (unix timestamp)
 * @param {string} params.nonce - 随机 nonce (bytes32)
 * @param {object} params.signer - ethers.js Signer 对象
 * @param {number} params.chainId - 链 ID
 * @param {string} params.usdcName - USDC 名称 (默认 "USD Coin")
 * @param {string} params.usdcVersion - USDC 版本 (默认 "2")
 * 
 * @returns {Promise<{v: number, r: string, s: string, signature: string}>}
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
}) {
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
 * 
 * @returns {string} bytes32 格式的随机 nonce
 */
export function generateNonce() {
  return ethers.hexlify(ethers.randomBytes(32));
}

/**
 * 创建 X402 支付请求
 * 
 * @param {object} params - 请求参数
 * @param {string} params.facilitatorUrl - Facilitator 服务器 URL
 * @param {string} params.escrowAddress - Escrow 合约地址
 * @param {string} params.usdcAddress - USDC 合约地址
 * @param {string} params.payer - 付款方地址
 * @param {string} params.payee - 收款方地址
 * @param {string|BigInt} params.amount - 金额
 * @param {number} params.deadline - 任务截止时间
 * @param {number} params.taskId - 任务 ID
 * @param {object} params.signer - ethers.js Signer
 * @param {number} params.chainId - 链 ID
 * 
 * @returns {Promise<{txHash: string, paymentHash: string}>}
 */
export async function createX402Payment({
  facilitatorUrl,
  escrowAddress,
  usdcAddress,
  payer,
  payee,
  amount,
  deadline,
  taskId,
  signer,
  chainId
}) {
  // 生成 paymentHash
  const paymentHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'address', 'uint256', 'uint256'],
      [taskId, payer, amount, Date.now()]
    )
  );

  // 生成 nonce
  const nonce = generateNonce();

  // 设置有效期 (1小时)
  const validAfter = 0;
  const validBefore = Math.floor(Date.now() / 1000) + 3600;

  // 生成 EIP-3009 签名
  const { v, r, s } = await generateEIP3009Signature({
    usdcAddress,
    from: payer,
    to: escrowAddress,  // 转给 Escrow
    value: amount,
    validAfter,
    validBefore,
    nonce,
    signer,
    chainId
  });

  // 调用 Facilitator API
  const response = await fetch(`${facilitatorUrl}/createPayment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      escrowAddress,
      paymentHash,
      payer,
      payee,
      usdcAddress,
      amount: amount.toString(),
      deadline,
      taskId,
      validAfter,
      validBefore,
      nonce,
      v, r, s
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Facilitator error: ${error.error}`);
  }

  const result = await response.json();

  return {
    txHash: result.txHash,
    paymentHash,
    blockNumber: result.blockNumber,
    gasUsed: result.gasUsed
  };
}

/**
 * 验证 EIP-3009 签名
 * 
 * @param {object} params - 验证参数
 * @param {string} params.facilitatorUrl - Facilitator 服务器 URL
 * @param {string} params.usdcAddress - USDC 合约地址
 * @param {string} params.from - 付款方地址
 * @param {string} params.to - 收款方地址
 * @param {string|BigInt} params.value - 金额
 * @param {number} params.validAfter - 有效起始时间
 * @param {number} params.validBefore - 有效截止时间
 * @param {string} params.nonce - Nonce
 * @param {number} params.v - 签名参数 v
 * @param {string} params.r - 签名参数 r
 * @param {string} params.s - 签名参数 s
 * 
 * @returns {Promise<{valid: boolean, balance: string}>}
 */
export async function verifyEIP3009Signature({
  facilitatorUrl,
  usdcAddress,
  from,
  to,
  value,
  validAfter,
  validBefore,
  nonce,
  v, r, s
}) {
  const response = await fetch(`${facilitatorUrl}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      usdcAddress,
      from,
      to,
      value: value.toString(),
      validAfter,
      validBefore,
      nonce,
      v, r, s
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Verification failed: ${error.error}`);
  }

  return await response.json();
}

export default {
  generateEIP3009Signature,
  generateNonce,
  createX402Payment,
  verifyEIP3009Signature
};

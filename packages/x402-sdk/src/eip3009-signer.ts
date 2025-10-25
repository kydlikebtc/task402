/**
 * EIP-3009 签名工具库
 * 用于生成和验证 transferWithAuthorization 签名
 */

import { ethers, TypedDataDomain, TypedDataField } from 'ethers';

/**
 * EIP-3009 TransferWithAuthorization 类型定义
 */
const TRANSFER_WITH_AUTHORIZATION_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes(
    'TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)'
  )
);

/**
 * 生成唯一 nonce (32 字节)
 */
export function generateNonce(): string {
  return ethers.hexlify(ethers.randomBytes(32));
}

/**
 * 创建 EIP-712 类型化数据
 */
export interface TransferAuthorizationParams {
  from: string;
  to: string;
  value: bigint;
  validAfter: number;
  validBefore: number;
  nonce: string;
}

export interface EIP3009TypedData {
  domain: TypedDataDomain;
  types: Record<string, TypedDataField[]>;
  message: TransferAuthorizationParams;
}

/**
 * 创建 EIP-712 类型化数据结构
 */
export function createTransferAuthorizationTypedData(
  usdcAddress: string,
  chainId: number,
  params: TransferAuthorizationParams
): EIP3009TypedData {
  // EIP-712 Domain
  const domain: TypedDataDomain = {
    name: 'USD Coin', // MockUSDC 的 name
    version: '1',
    chainId: chainId,
    verifyingContract: usdcAddress,
  };

  // EIP-712 Types
  const types: Record<string, TypedDataField[]> = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  };

  return {
    domain,
    types,
    message: params,
  };
}

/**
 * 签名 TransferWithAuthorization
 */
export async function signTransferAuthorization(
  signer: ethers.Signer,
  usdcAddress: string,
  chainId: number,
  params: TransferAuthorizationParams
): Promise<string> {
  const typedData = createTransferAuthorizationTypedData(usdcAddress, chainId, params);

  // 使用 ethers v6 的 signTypedData
  const signature = await signer.signTypedData(
    typedData.domain,
    typedData.types,
    typedData.message
  );

  return signature;
}

/**
 * 分解签名为 v, r, s
 */
export function splitSignature(signature: string): {
  v: number;
  r: string;
  s: string;
} {
  const sig = ethers.Signature.from(signature);
  return {
    v: sig.v,
    r: sig.r,
    s: sig.s,
  };
}

/**
 * 验证签名 (链下验证)
 */
export function verifyTransferAuthorization(
  signature: string,
  usdcAddress: string,
  chainId: number,
  params: TransferAuthorizationParams
): string {
  const typedData = createTransferAuthorizationTypedData(usdcAddress, chainId, params);

  // 构建 EIP-712 哈希
  const domain = ethers.TypedDataEncoder.hashDomain(typedData.domain);
  const structHash = ethers.TypedDataEncoder.hash(
    typedData.domain,
    typedData.types,
    typedData.message
  );

  // 恢复签名者地址
  const recoveredAddress = ethers.recoverAddress(structHash, signature);

  return recoveredAddress;
}

/**
 * 完整的签名流程封装
 */
export async function createEIP3009Authorization(
  signer: ethers.Signer,
  usdcAddress: string,
  chainId: number,
  to: string,
  value: bigint,
  validUntilTimestamp?: number
): Promise<{
  signature: string;
  params: TransferAuthorizationParams;
  split: { v: number; r: string; s: string };
}> {
  const from = await signer.getAddress();
  const nonce = generateNonce();
  const validAfter = 0; // 立即生效
  const validBefore = validUntilTimestamp || Math.floor(Date.now() / 1000) + 3600; // 默认 1 小时

  const params: TransferAuthorizationParams = {
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
  };

  const signature = await signTransferAuthorization(signer, usdcAddress, chainId, params);
  const split = splitSignature(signature);

  return {
    signature,
    params,
    split,
  };
}

/**
 * Facilitator 服务器类型定义
 */

export interface EIP3009Signature {
  v: number;
  r: string;
  s: string;
  nonce: string;
  validAfter: number;
  validBefore: number;
}

export interface CreateTaskRequest {
  description: string;
  reward: string; // USDC amount in wei (6 decimals)
  deadline: number; // Unix timestamp
  category: number; // TaskCategory enum
  creator: string; // Creator address
  signature: EIP3009Signature;
}

export interface CreateTaskResponse {
  success: boolean;
  taskId?: number;
  txHash?: string;
  gasUsed?: string;
  error?: string;
}

export interface FacilitatorConfig {
  port: number;
  rpcUrl: string;
  chainId: number;
  privateKey: string; // Facilitator wallet private key
  contracts: {
    taskRegistry: string;
    escrow: string;
    usdc: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  gasLimit: {
    maxGasPrice: string; // in gwei
    maxGasLimit: number;
  };
}

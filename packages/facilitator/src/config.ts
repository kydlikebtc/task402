/**
 * Facilitator 配置管理
 */

import { FacilitatorConfig } from './types';
import * as fs from 'fs';
import * as path from 'path';

export function loadConfig(): FacilitatorConfig {
  // 从环境变量或配置文件加载
  const configPath = process.env.CONFIG_PATH || path.join(__dirname, '../config.json');
  
  let config: Partial<FacilitatorConfig> = {};
  
  // 尝试读取配置文件
  if (fs.existsSync(configPath)) {
    const configFile = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(configFile);
  }
  
  // 环境变量优先
  const finalConfig: FacilitatorConfig = {
    port: parseInt(process.env.PORT || config.port?.toString() || '3001'),
    rpcUrl: process.env.RPC_URL || config.rpcUrl || 'http://127.0.0.1:8545',
    chainId: parseInt(process.env.CHAIN_ID || config.chainId?.toString() || '31337'),
    privateKey: process.env.PRIVATE_KEY || config.privateKey || '',
    contracts: {
      taskRegistry: process.env.TASK_REGISTRY || config.contracts?.taskRegistry || '',
      escrow: process.env.ESCROW || config.contracts?.escrow || '',
      usdc: process.env.USDC || config.contracts?.usdc || '',
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || config.rateLimit?.windowMs?.toString() || '3600000'), // 1 hour
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX || config.rateLimit?.maxRequests?.toString() || '10'),
    },
    gasLimit: {
      maxGasPrice: process.env.MAX_GAS_PRICE || config.gasLimit?.maxGasPrice || '100', // 100 gwei
      maxGasLimit: parseInt(process.env.MAX_GAS_LIMIT || config.gasLimit?.maxGasLimit?.toString() || '500000'),
    },
  };
  
  // 验证必需配置
  if (!finalConfig.privateKey) {
    throw new Error('PRIVATE_KEY is required');
  }
  
  if (!finalConfig.contracts.taskRegistry) {
    throw new Error('TASK_REGISTRY address is required');
  }
  
  return finalConfig;
}

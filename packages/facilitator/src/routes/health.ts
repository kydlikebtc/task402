/**
 * 健康检查路由
 */

import { Request, Response } from 'express';
import { ethers } from 'ethers';
import { FacilitatorConfig } from '../types';

export function healthCheck(config: FacilitatorConfig) {
  return async (req: Request, res: Response) => {
    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const wallet = new ethers.Wallet(config.privateKey, provider);

      // 检查网络连接
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      const balance = await provider.getBalance(wallet.address);

      res.json({
        status: 'ok',
        facilitator: wallet.address,
        network: {
          chainId: network.chainId.toString(),
          blockNumber,
        },
        balance: ethers.formatEther(balance),
        contracts: config.contracts,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        error: error.message,
      });
    }
  };
}

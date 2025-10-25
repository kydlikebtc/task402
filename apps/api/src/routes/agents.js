import express from 'express';
import { blockchainService } from '../utils/blockchain.js';
import { logAgentOperation } from '../utils/logger.js';

export const agentRoutes = express.Router();

/**
 * GET /api/agents/:address - 获取 Agent 信息
 */
agentRoutes.get('/:address', async (req, res, next) => {
  try {
    const { address } = req.params;

    logAgentOperation('get', address);

    const stats = await blockchainService.getAgentStats(address);

    res.json({
      success: true,
      address,
      ...stats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agents/:address/tasks - 获取 Agent 的任务列表
 */
agentRoutes.get('/:address/tasks', async (req, res, next) => {
  try {
    const { address } = req.params;

    logAgentOperation('list_tasks', address);

    // TODO: 实现链下索引以快速查询
    // 暂时返回空数组
    res.json({
      success: true,
      address,
      tasks: []
    });
  } catch (error) {
    next(error);
  }
});

import express from 'express';
import { agentExecutorService } from '../services/agentExecutor.js';
import { logger } from '../utils/logger.js';

export const agentExecutorRoutes = express.Router();

/**
 * POST /api/agent/start - 启动 Agent 执行器
 */
agentExecutorRoutes.post('/start', async (req, res, next) => {
  try {
    logger.info('Starting agent executor...');
    await agentExecutorService.start();

    res.json({
      success: true,
      message: 'Agent executor started'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/agent/stop - 停止 Agent 执行器
 */
agentExecutorRoutes.post('/stop', (req, res) => {
  logger.info('Stopping agent executor...');
  agentExecutorService.stop();

  res.json({
    success: true,
    message: 'Agent executor stopped'
  });
});

/**
 * GET /api/agent/status - 获取 Agent 状态
 */
agentExecutorRoutes.get('/status', async (req, res, next) => {
  try {
    const stats = await agentExecutorService.getStats();

    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    next(error);
  }
});

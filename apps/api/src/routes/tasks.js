import express from 'express';
import { blockchainService } from '../utils/blockchain.js';
import { logger, logTaskOperation } from '../utils/logger.js';

export const taskRoutes = express.Router();

/**
 * GET /api/tasks - 获取任务列表
 */
taskRoutes.get('/', async (req, res, next) => {
  try {
    const { limit = 10, status = 'open' } = req.query;

    logTaskOperation('list', null, { limit, status });

    let tasks;
    if (status === 'open') {
      tasks = await blockchainService.getOpenTasks(parseInt(limit));
    } else {
      // TODO: 支持其他状态过滤
      tasks = await blockchainService.getOpenTasks(parseInt(limit));
    }

    res.json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tasks/:taskId - 获取任务详情
 */
taskRoutes.get('/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;

    logTaskOperation('get', taskId);

    const task = await blockchainService.getTask(taskId);

    res.json({
      success: true,
      task
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tasks/:taskId/assign - Agent 接单
 */
taskRoutes.post('/:taskId/assign', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { agentAddress } = req.body;

    if (!agentAddress) {
      return res.status(400).json({
        success: false,
        error: 'agentAddress is required'
      });
    }

    logTaskOperation('assign', taskId, { agentAddress });

    const result = await blockchainService.assignTask(taskId, agentAddress);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tasks/:taskId/submit - 提交任务结果
 */
taskRoutes.post('/:taskId/submit', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { resultHash } = req.body;

    if (!resultHash) {
      return res.status(400).json({
        success: false,
        error: 'resultHash is required'
      });
    }

    logTaskOperation('submit', taskId, { resultHash });

    const result = await blockchainService.submitTask(taskId, resultHash);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tasks/:taskId/status - 获取任务状态
 */
taskRoutes.get('/:taskId/status', async (req, res, next) => {
  try {
    const { taskId } = req.params;

    const task = await blockchainService.getTask(taskId);

    res.json({
      success: true,
      taskId,
      status: task.status,
      assignedAgent: task.assignedAgent,
      resultHash: task.resultHash
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tasks/:taskId/description - 获取任务详细描述（受 X402 保护）
 * 需要支付 $0.001 USDC
 */
taskRoutes.get('/:taskId/description', async (req, res, next) => {
  try {
    const { taskId } = req.params;

    logTaskOperation('get_description', taskId, {
      paidBy: req.payment?.payload?.from || 'unknown'
    });

    // X402 middleware 已验证支付
    const task = await blockchainService.getTask(taskId);

    // 返回完整的任务描述
    res.json({
      success: true,
      taskId,
      description: task.description,
      reward: task.reward,
      rewardToken: task.rewardToken,
      deadline: task.deadline,
      category: task.category,
      creator: task.creator,
      status: task.status,
      payment: {
        from: req.payment?.payload?.from,
        amount: req.payment?.payload?.value,
        txHash: null // 将在异步结算后更新
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tasks/:taskId/result - 获取任务结果（受 X402 保护）
 * 需要支付 $0.005 USDC
 */
taskRoutes.get('/:taskId/result', async (req, res, next) => {
  try {
    const { taskId } = req.params;

    logTaskOperation('get_result', taskId, {
      paidBy: req.payment?.payload?.from || 'unknown'
    });

    const task = await blockchainService.getTask(taskId);

    // 检查任务是否已完成
    if (task.status !== 'Completed') {
      return res.status(400).json({
        success: false,
        error: 'Task not completed yet',
        currentStatus: task.status
      });
    }

    // 返回任务结果
    res.json({
      success: true,
      taskId,
      resultHash: task.resultHash,
      assignedAgent: task.assignedAgent,
      completedAt: task.completedAt,
      payment: {
        from: req.payment?.payload?.from,
        amount: req.payment?.payload?.value
      }
    });
  } catch (error) {
    next(error);
  }
});

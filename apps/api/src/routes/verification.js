import express from 'express';
import { blockchainService } from '../utils/blockchain.js';
import { logVerificationOperation } from '../utils/logger.js';
import { aiVerificationService } from '../services/aiVerification.js';

export const verificationRoutes = express.Router();

/**
 * POST /api/verification/verify - 验证任务结果
 * 由验证节点或 AI 共识调用
 */
verificationRoutes.post('/verify', async (req, res, next) => {
  try {
    const { taskId, resultHash, autoVerify = false } = req.body;

    if (!taskId || !resultHash) {
      return res.status(400).json({
        success: false,
        error: 'taskId and resultHash are required'
      });
    }

    logVerificationOperation('verify', taskId, { resultHash, autoVerify });

    let approved = false;

    // 如果启用自动验证，使用 AI 验证
    if (autoVerify) {
      const task = await blockchainService.getTask(taskId);
      approved = await aiVerificationService.verifyTaskResult(task, resultHash);

      logVerificationOperation('ai_verification', taskId, {
        resultHash,
        approved
      });
    } else {
      // 手动验证，从请求中获取
      approved = req.body.approved === true;
    }

    // 调用区块链验证
    const result = await blockchainService.verifyTask(taskId, approved);

    res.json({
      success: true,
      ...result,
      approved
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/verification/auto-verify - AI 自动验证
 */
verificationRoutes.post('/auto-verify', async (req, res, next) => {
  try {
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'taskId is required'
      });
    }

    logVerificationOperation('auto_verify', taskId);

    // 获取任务信息
    const task = await blockchainService.getTask(taskId);

    if (!task.resultHash) {
      return res.status(400).json({
        success: false,
        error: 'Task has no result to verify'
      });
    }

    // AI 验证
    const approved = await aiVerificationService.verifyTaskResult(
      task,
      task.resultHash
    );

    logVerificationOperation('ai_verification_complete', taskId, { approved });

    // 提交验证结果到区块链
    const result = await blockchainService.verifyTask(taskId, approved);

    res.json({
      success: true,
      ...result,
      approved,
      method: 'ai_verification'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 创建任务路由
 */

import { Request, Response } from 'express';
import { CreateTaskRequest, FacilitatorConfig } from '../types';
import { executeCreateTask } from '../services/transaction';

export function createTaskRoute(config: FacilitatorConfig) {
  return async (req: Request, res: Response) => {
    try {
      const request: CreateTaskRequest = req.body;

      // 验证请求参数
      if (!request.description || !request.reward || !request.deadline || request.category === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: description, reward, deadline, category',
        });
      }

      if (!request.creator || !request.signature) {
        return res.status(400).json({
          success: false,
          error: 'Missing creator or signature',
        });
      }

      // 验证签名格式
      const { signature } = request;
      if (!signature.v || !signature.r || !signature.s || !signature.nonce) {
        return res.status(400).json({
          success: false,
          error: 'Invalid signature format',
        });
      }

      console.log(`[API] Received create task request from ${request.creator}`);
      console.log(`[API] Reward: ${request.reward} wei, Deadline: ${new Date(request.deadline * 1000).toISOString()}`);

      // 执行交易
      const result = await executeCreateTask(request, config);

      if (result.success) {
        console.log(`[API] Task created successfully: ${result.taskId}`);
        res.json(result);
      } else {
        console.error(`[API] Task creation failed: ${result.error}`);
        res.status(400).json(result);
      }

    } catch (error: any) {
      console.error('[API] Unexpected error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  };
}

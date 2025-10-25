/**
 * Facilitator Express 服务器
 */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { loadConfig } from './config';
import { healthCheck } from './routes/health';
import { createTaskRoute } from './routes/create-task';

async function main() {
  const config = loadConfig();

  const app = express();

  // 中间件
  app.use(cors());
  app.use(express.json());

  // 速率限制
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    // 按 IP 地址限制
    keyGenerator: (req) => {
      return req.headers['x-forwarded-for'] as string || req.ip || 'unknown';
    },
  });

  // 路由
  app.get('/health', healthCheck(config));
  app.post('/api/v1/tasks/create', limiter, createTaskRoute(config));

  // 错误处理
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  });

  // 启动服务器
  app.listen(config.port, () => {
    console.log(`==============================================`);
    console.log(`  Facilitator Server Started`);
    console.log(`==============================================`);
    console.log(`  Port: ${config.port}`);
    console.log(`  Chain ID: ${config.chainId}`);
    console.log(`  RPC URL: ${config.rpcUrl}`);
    console.log(`  TaskRegistry: ${config.contracts.taskRegistry}`);
    console.log(`  Rate Limit: ${config.rateLimit.maxRequests} requests per ${config.rateLimit.windowMs / 1000}s`);
    console.log(`  Max Gas Price: ${config.gasLimit.maxGasPrice} gwei`);
    console.log(`==============================================`);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

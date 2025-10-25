import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
import { taskRoutes } from './routes/tasks.js';
import { agentRoutes } from './routes/agents.js';
import { verificationRoutes } from './routes/verification.js';
import { agentExecutorRoutes } from './routes/agent.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { x402Middleware } from './middleware/x402.js';
import { blockchainService } from './utils/blockchain.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ============ 中间件 ============
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(rateLimiter);

// ============ X402 支付中间件 ============
const X402_RECIPIENT = process.env.X402_RECIPIENT_ADDRESS || '0x0000000000000000000000000000000000000000';
app.use(
  x402Middleware(X402_RECIPIENT, {
    '/api/tasks/:id/description': '$0.001',  // 查看任务详情: $0.001
    '/api/tasks/:id/result': '$0.005',       // 获取任务结果: $0.005
    '/api/agent/execute': '$0.01'            // Agent 执行服务: $0.01
  }, {
    facilitatorUrl: process.env.FACILITATOR_URL || 'http://localhost:3002',
    network: process.env.X402_NETWORK || 'base-sepolia'
  })
);

// ============ 日志中间件 ============
app.use((req, res, next) => {
  logger.info({
    message: 'Incoming request',
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// ============ 健康检查 ============
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    network: process.env.NETWORK || 'localhost'
  });
});

// ============ API 路由 ============
app.use('/api/tasks', taskRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/agent', agentExecutorRoutes);

// ============ 404 处理 ============
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

// ============ 错误处理 ============
app.use(errorHandler);

// ============ 启动服务器 ============
app.listen(PORT, async () => {
  logger.info({
    message: '🚀 Task402 API Server started',
    port: PORT,
    network: process.env.NETWORK || 'localhost',
    nodeEnv: process.env.NODE_ENV || 'development'
  });

  // 初始化区块链连接
  try {
    await blockchainService.initialize();
    logger.info('✅ Blockchain service initialized');
  } catch (error) {
    logger.error({
      message: '❌ Blockchain initialization failed',
      error: error.message
    });
  }
});

// ============ 优雅关闭 ============
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

export default app;

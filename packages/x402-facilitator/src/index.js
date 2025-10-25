import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { verifyPayment } from './services/verify.js';
import { settlePayment } from './services/settle.js';
import { logger } from './utils/logger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// 中间件
app.use(cors());
app.use(express.json());

// 日志中间件
app.use((req, res, next) => {
  logger.info({
    message: 'Incoming request',
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  next();
});

/**
 * POST /verify
 * 验证支付签名（不执行链上交易）
 */
app.post('/verify', async (req, res) => {
  try {
    const { payment } = req.body;

    logger.info({
      message: 'Verify payment request',
      scheme: payment?.scheme,
      network: payment?.network
    });

    const result = await verifyPayment(payment);

    logger.info({
      message: 'Verification result',
      isValid: result.isValid,
      invalidReason: result.invalidReason
    });

    res.json(result);
  } catch (error) {
    logger.error({
      message: 'Verify error',
      error: error.message,
      stack: error.stack
    });

    res.json({
      isValid: false,
      invalidReason: error.message
    });
  }
});

/**
 * POST /settle
 * 执行链上支付结算
 */
app.post('/settle', async (req, res) => {
  try {
    const { payment } = req.body;

    logger.info({
      message: 'Settle payment request',
      scheme: payment?.scheme,
      network: payment?.network,
      amount: payment?.payload?.value
    });

    const result = await settlePayment(payment);

    logger.info({
      message: 'Settlement result',
      success: result.success,
      txHash: result.txHash
    });

    res.json(result);
  } catch (error) {
    logger.error({
      message: 'Settle error',
      error: error.message,
      stack: error.stack
    });

    res.json({
      success: false,
      error: error.message,
      txHash: null,
      networkId: null
    });
  }
});

/**
 * GET /supported
 * 返回支持的 (scheme, network) 组合
 */
app.get('/supported', (req, res) => {
  const supported = {
    kinds: [
      {
        scheme: 'exact',
        network: 'base-sepolia'
      },
      {
        scheme: 'exact',
        network: 'base'
      }
    ]
  };

  logger.info({
    message: 'Supported schemes requested',
    kinds: supported.kinds.length
  });

  res.json(supported);
});

/**
 * GET /health
 * 健康检查
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'x402-facilitator',
    timestamp: new Date().toISOString()
  });
});

// 启动服务器
app.listen(PORT, () => {
  logger.info({
    message: '🚀 X402 Facilitator Server started',
    port: PORT,
    env: process.env.NODE_ENV || 'development'
  });
});

export default app;

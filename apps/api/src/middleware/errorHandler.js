import { logger } from '../utils/logger.js';

/**
 * 全局错误处理中间件
 */
export const errorHandler = (err, req, res, next) => {
  // 记录错误详情以便调试
  logger.error({
    message: 'API Error',
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    ip: req.ip
  });

  // 区分错误类型
  if (err.code === 'CALL_EXCEPTION') {
    // 智能合约调用错误
    return res.status(400).json({
      success: false,
      error: 'Smart contract error',
      message: err.reason || err.message
    });
  }

  if (err.name === 'ValidationError') {
    // 验证错误
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: err.message
    });
  }

  // 默认服务器错误
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
};

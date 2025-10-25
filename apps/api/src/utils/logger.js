import winston from 'winston';

/**
 * 日志工具 - 使用 Winston
 * 记录所有关键操作以便调试和审计
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'task402-api' },
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(meta).length > 0 && meta.service !== 'task402-api') {
            msg += ` ${JSON.stringify(meta)}`;
          }
          return msg;
        })
      )
    }),
    // 错误日志文件
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    // 所有日志文件
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

/**
 * 任务操作日志
 */
export const logTaskOperation = (operation, taskId, data = {}) => {
  logger.info({
    message: `Task operation: ${operation}`,
    taskId,
    operation,
    ...data
  });
};

/**
 * Agent 操作日志
 */
export const logAgentOperation = (operation, agentAddress, data = {}) => {
  logger.info({
    message: `Agent operation: ${operation}`,
    agentAddress,
    operation,
    ...data
  });
};

/**
 * 支付操作日志
 */
export const logPaymentOperation = (operation, paymentHash, data = {}) => {
  logger.info({
    message: `Payment operation: ${operation}`,
    paymentHash,
    operation,
    ...data
  });
};

/**
 * 验证操作日志
 */
export const logVerificationOperation = (operation, taskId, data = {}) => {
  logger.info({
    message: `Verification operation: ${operation}`,
    taskId,
    operation,
    ...data
  });
};

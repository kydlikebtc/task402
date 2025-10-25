import winston from 'winston';

/**
 * X402 Facilitator 日志工具
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'x402-facilitator' },
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          const filteredMeta = { ...meta };
          delete filteredMeta.service;
          if (Object.keys(filteredMeta).length > 0) {
            msg += ` ${JSON.stringify(filteredMeta)}`;
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

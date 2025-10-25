import axios from 'axios';
import { logger } from '../utils/logger.js';

/**
 * X402 支付中间件
 * 基于 Coinbase X402 协议实现
 *
 * @param {string} recipientAddress - 收款地址
 * @param {Object} endpoints - 端点配置 { "/path": "$0.01" }
 * @param {Object} options - 选项配置
 * @returns {Function} Express 中间件
 */
export function x402Middleware(recipientAddress, endpoints, options = {}) {
  const {
    facilitatorUrl = process.env.FACILITATOR_URL || 'http://localhost:3002',
    network = 'base-sepolia',
    assetContract = getUSDCAddress(network),
    scheme = 'exact',
    timeout = 3600 // 1小时
  } = options;

  return async (req, res, next) => {
    // 检查当前路径是否需要支付保护
    const matchedPath = findMatchingPath(req.path, endpoints);

    if (!matchedPath) {
      // 不需要支付，直接通过
      return next();
    }

    const requiredAmount = parseAmount(endpoints[matchedPath]);

    logger.info({
      message: 'X402 protected endpoint accessed',
      path: req.path,
      matchedPath,
      requiredAmount: requiredAmount.toString()
    });

    // 检查是否有 X-PAYMENT header
    const paymentHeader = req.get('X-PAYMENT');

    if (!paymentHeader) {
      // 没有支付，返回 402 Payment Required
      return sendPaymentRequired(res, {
        recipientAddress,
        requiredAmount,
        resourceUrl: req.originalUrl,
        network,
        assetContract,
        scheme,
        timeout
      });
    }

    // 验证支付
    try {
      const payment = JSON.parse(paymentHeader);

      logger.info({
        message: 'Verifying payment',
        scheme: payment.scheme,
        network: payment.network
      });

      // 调用 Facilitator 验证支付
      const isValid = await verifyPayment(payment, facilitatorUrl);

      if (!isValid.isValid) {
        logger.warn({
          message: 'Payment verification failed',
          reason: isValid.invalidReason
        });

        return res.status(402).json({
          error: 'Invalid payment',
          reason: isValid.invalidReason
        });
      }

      logger.info({
        message: 'Payment verified successfully',
        from: payment.payload?.from,
        to: payment.payload?.to,
        value: payment.payload?.value
      });

      // 验证金额是否足够
      if (BigInt(payment.payload.value) < BigInt(requiredAmount)) {
        return res.status(402).json({
          error: 'Insufficient payment amount',
          required: requiredAmount.toString(),
          provided: payment.payload.value
        });
      }

      // 验证接收地址是否正确
      if (payment.payload.to.toLowerCase() !== recipientAddress.toLowerCase()) {
        return res.status(402).json({
          error: 'Incorrect recipient address',
          expected: recipientAddress,
          provided: payment.payload.to
        });
      }

      // 支付验证通过，附加支付信息到请求对象
      req.payment = payment;

      // 异步结算支付（不阻塞响应）
      settlePaymentAsync(payment, facilitatorUrl).catch(error => {
        logger.error({
          message: 'Async settlement failed',
          error: error.message
        });
      });

      // 继续处理请求
      next();
    } catch (error) {
      logger.error({
        message: 'Payment processing error',
        error: error.message
      });

      return res.status(400).json({
        error: 'Invalid payment header',
        details: error.message
      });
    }
  };
}

/**
 * 发送 402 Payment Required 响应
 */
function sendPaymentRequired(res, config) {
  const {
    recipientAddress,
    requiredAmount,
    resourceUrl,
    network,
    assetContract,
    scheme,
    timeout
  } = config;

  const validAfter = Math.floor(Date.now() / 1000);
  const validBefore = validAfter + timeout;

  const response = {
    x402: '1.0',
    paymentRequirements: [
      {
        scheme,
        network,
        maxAmount: requiredAmount.toString(),
        resourceUrl,
        description: `Access to ${resourceUrl}`,
        mimeType: 'application/json',
        recipientAddress,
        timeout,
        assetContract,
        extra: {
          validAfter,
          validBefore
        }
      }
    ]
  };

  logger.info({
    message: 'Sending 402 Payment Required',
    resourceUrl,
    requiredAmount: requiredAmount.toString()
  });

  res.status(402).json(response);
}

/**
 * 验证支付
 */
async function verifyPayment(payment, facilitatorUrl) {
  try {
    const response = await axios.post(`${facilitatorUrl}/verify`, {
      payment
    }, {
      timeout: 5000
    });

    return response.data;
  } catch (error) {
    logger.error({
      message: 'Facilitator verification request failed',
      error: error.message
    });

    return {
      isValid: false,
      invalidReason: `Facilitator error: ${error.message}`
    };
  }
}

/**
 * 异步结算支付
 */
async function settlePaymentAsync(payment, facilitatorUrl) {
  try {
    logger.info({
      message: 'Initiating async settlement',
      from: payment.payload?.from,
      to: payment.payload?.to,
      value: payment.payload?.value
    });

    const response = await axios.post(`${facilitatorUrl}/settle`, {
      payment
    }, {
      timeout: 30000 // 30秒超时
    });

    if (response.data.success) {
      logger.info({
        message: 'Payment settled successfully',
        txHash: response.data.txHash,
        networkId: response.data.networkId
      });
    } else {
      logger.error({
        message: 'Payment settlement failed',
        error: response.data.error
      });
    }

    return response.data;
  } catch (error) {
    logger.error({
      message: 'Settlement request failed',
      error: error.message
    });
    throw error;
  }
}

/**
 * 查找匹配的路径
 */
function findMatchingPath(reqPath, endpoints) {
  // 精确匹配
  if (endpoints[reqPath]) {
    return reqPath;
  }

  // 模式匹配（支持 :id 等参数）
  for (const pattern in endpoints) {
    const regex = new RegExp('^' + pattern.replace(/:\w+/g, '[^/]+') + '$');
    if (regex.test(reqPath)) {
      return pattern;
    }
  }

  return null;
}

/**
 * 解析金额字符串（如 "$0.01"）为 USDC 最小单位（6 decimals）
 */
function parseAmount(amountStr) {
  const match = amountStr.match(/^\$?([\d.]+)$/);
  if (!match) {
    throw new Error(`Invalid amount format: ${amountStr}`);
  }

  const dollars = parseFloat(match[1]);
  // USDC 有 6 位小数
  const usdcUnits = BigInt(Math.floor(dollars * 1000000));

  return usdcUnits;
}

/**
 * 获取 USDC 合约地址
 */
function getUSDCAddress(network) {
  const addresses = {
    'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    'ethereum': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    'sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
  };

  return addresses[network] || addresses['base-sepolia'];
}

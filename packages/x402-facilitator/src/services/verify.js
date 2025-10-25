import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';

/**
 * 验证 X402 支付签名
 * 支持 EIP-3009 (transferWithAuthorization)
 *
 * @param {Object} payment - X402 支付对象
 * @returns {Object} { isValid: boolean, invalidReason: string | null }
 */
export async function verifyPayment(payment) {
  try {
    // 验证必需字段
    if (!payment || !payment.scheme || !payment.network) {
      return {
        isValid: false,
        invalidReason: 'Missing required payment fields'
      };
    }

    // 目前只支持 exact scheme
    if (payment.scheme !== 'exact') {
      return {
        isValid: false,
        invalidReason: `Unsupported scheme: ${payment.scheme}`
      };
    }

    // 验证 exact scheme 的 payload
    const result = await verifyExactPayment(payment);

    return result;
  } catch (error) {
    logger.error({
      message: 'Payment verification failed',
      error: error.message
    });

    return {
      isValid: false,
      invalidReason: error.message
    };
  }
}

/**
 * 验证 exact scheme 支付（EIP-3009）
 */
async function verifyExactPayment(payment) {
  const { payload, network } = payment;

  // 验证 payload 结构
  const requiredFields = [
    'from',
    'to',
    'value',
    'validAfter',
    'validBefore',
    'nonce',
    'v',
    'r',
    's'
  ];

  for (const field of requiredFields) {
    if (!(field in payload)) {
      return {
        isValid: false,
        invalidReason: `Missing payload field: ${field}`
      };
    }
  }

  try {
    // 重建 EIP-3009 消息哈希
    const domain = {
      name: 'USD Coin',
      version: '2',
      chainId: getChainId(network),
      verifyingContract: getUSDCAddress(network)
    };

    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' }
      ]
    };

    const message = {
      from: payload.from,
      to: payload.to,
      value: payload.value,
      validAfter: payload.validAfter,
      validBefore: payload.validBefore,
      nonce: payload.nonce
    };

    // 验证签名
    const signature = {
      v: payload.v,
      r: payload.r,
      s: payload.s
    };

    const digest = ethers.TypedDataEncoder.hash(domain, types, message);
    const recoveredAddress = ethers.recoverAddress(digest, signature);

    // 检查签名者是否是 from 地址
    if (recoveredAddress.toLowerCase() !== payload.from.toLowerCase()) {
      logger.warn({
        message: 'Signature verification failed',
        expected: payload.from,
        recovered: recoveredAddress
      });

      return {
        isValid: false,
        invalidReason: 'Invalid signature'
      };
    }

    // 检查时间有效性
    const now = Math.floor(Date.now() / 1000);
    if (now < parseInt(payload.validAfter)) {
      return {
        isValid: false,
        invalidReason: 'Payment not yet valid'
      };
    }

    if (now > parseInt(payload.validBefore)) {
      return {
        isValid: false,
        invalidReason: 'Payment expired'
      };
    }

    logger.info({
      message: 'Payment verified successfully',
      from: payload.from,
      to: payload.to,
      value: payload.value
    });

    return {
      isValid: true,
      invalidReason: null
    };
  } catch (error) {
    logger.error({
      message: 'Signature verification error',
      error: error.message
    });

    return {
      isValid: false,
      invalidReason: `Verification error: ${error.message}`
    };
  }
}

/**
 * 获取网络的 Chain ID
 */
function getChainId(network) {
  const chainIds = {
    'base-sepolia': 84532,
    'base': 8453,
    'ethereum': 1,
    'sepolia': 11155111
  };

  return chainIds[network] || 84532;
}

/**
 * 获取 USDC 合约地址
 */
function getUSDCAddress(network) {
  const addresses = {
    'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
    'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',        // Base Mainnet USDC
    'ethereum': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',    // Ethereum USDC
    'sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'     // Sepolia USDC (example)
  };

  return addresses[network] || addresses['base-sepolia'];
}

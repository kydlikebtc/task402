import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';

// USDC 合约 ABI - transferWithAuthorization 方法
const USDC_ABI = [
  'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external',
  'function balanceOf(address account) external view returns (uint256)',
  'function authorizationState(address authorizer, bytes32 nonce) external view returns (bool)'
];

/**
 * 执行 X402 支付结算（链上交易）
 *
 * @param {Object} payment - X402 支付对象
 * @returns {Object} { success: boolean, error: string | null, txHash: string | null, networkId: string | null }
 */
export async function settlePayment(payment) {
  try {
    // 验证必需字段
    if (!payment || !payment.scheme || !payment.network) {
      return {
        success: false,
        error: 'Missing required payment fields',
        txHash: null,
        networkId: null
      };
    }

    // 目前只支持 exact scheme
    if (payment.scheme !== 'exact') {
      return {
        success: false,
        error: `Unsupported scheme: ${payment.scheme}`,
        txHash: null,
        networkId: null
      };
    }

    // 执行 exact scheme 结算
    const result = await settleExactPayment(payment);

    return result;
  } catch (error) {
    logger.error({
      message: 'Payment settlement failed',
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      error: error.message,
      txHash: null,
      networkId: null
    };
  }
}

/**
 * 执行 exact scheme 支付结算（EIP-3009）
 */
async function settleExactPayment(payment) {
  const { payload, network } = payment;

  try {
    // 获取 provider 和 signer
    const { provider, signer } = getProviderAndSigner(network);

    // 获取 USDC 合约实例
    const usdcAddress = getUSDCAddress(network);
    const usdcContract = new ethers.Contract(usdcAddress, USDC_ABI, signer);

    logger.info({
      message: 'Preparing settlement transaction',
      network,
      from: payload.from,
      to: payload.to,
      value: payload.value,
      usdcAddress
    });

    // 检查授权是否已使用
    const isUsed = await usdcContract.authorizationState(
      payload.from,
      payload.nonce
    );

    if (isUsed) {
      logger.warn({
        message: 'Authorization already used',
        nonce: payload.nonce
      });

      return {
        success: false,
        error: 'Authorization nonce already used',
        txHash: null,
        networkId: network
      };
    }

    // 检查发送者余额
    const balance = await usdcContract.balanceOf(payload.from);
    if (balance < BigInt(payload.value)) {
      logger.warn({
        message: 'Insufficient balance',
        from: payload.from,
        balance: balance.toString(),
        required: payload.value
      });

      return {
        success: false,
        error: 'Insufficient balance',
        txHash: null,
        networkId: network
      };
    }

    // 执行 transferWithAuthorization
    logger.info({
      message: 'Submitting transaction to blockchain',
      from: payload.from,
      to: payload.to,
      value: payload.value
    });

    const tx = await usdcContract.transferWithAuthorization(
      payload.from,
      payload.to,
      payload.value,
      payload.validAfter,
      payload.validBefore,
      payload.nonce,
      payload.v,
      payload.r,
      payload.s
    );

    logger.info({
      message: 'Transaction submitted',
      txHash: tx.hash,
      network
    });

    // 等待交易确认
    const receipt = await tx.wait();

    logger.info({
      message: 'Transaction confirmed',
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status
    });

    if (receipt.status === 0) {
      return {
        success: false,
        error: 'Transaction reverted',
        txHash: receipt.hash,
        networkId: network
      };
    }

    return {
      success: true,
      error: null,
      txHash: receipt.hash,
      networkId: network
    };
  } catch (error) {
    logger.error({
      message: 'Settlement transaction failed',
      error: error.message,
      code: error.code,
      stack: error.stack
    });

    // 解析常见错误
    let errorMessage = error.message;

    if (error.code === 'INSUFFICIENT_FUNDS') {
      errorMessage = 'Facilitator has insufficient gas funds';
    } else if (error.message.includes('nonce')) {
      errorMessage = 'Invalid or already used nonce';
    } else if (error.message.includes('signature')) {
      errorMessage = 'Invalid signature';
    }

    return {
      success: false,
      error: errorMessage,
      txHash: null,
      networkId: network
    };
  }
}

/**
 * 获取 Provider 和 Signer
 */
function getProviderAndSigner(network) {
  const rpcUrl = getRpcUrl(network);
  const privateKey = process.env.FACILITATOR_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error('FACILITATOR_PRIVATE_KEY not configured');
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  logger.info({
    message: 'Provider and signer initialized',
    network,
    signerAddress: signer.address
  });

  return { provider, signer };
}

/**
 * 获取网络的 RPC URL
 */
function getRpcUrl(network) {
  // 优先使用环境变量
  const envKey = `${network.toUpperCase().replace('-', '_')}_RPC_URL`;
  if (process.env[envKey]) {
    return process.env[envKey];
  }

  // 默认 RPC URLs
  const rpcUrls = {
    'base-sepolia': 'https://sepolia.base.org',
    'base': 'https://mainnet.base.org',
    'ethereum': 'https://eth.llamarpc.com',
    'sepolia': 'https://rpc.sepolia.org'
  };

  return rpcUrls[network] || rpcUrls['base-sepolia'];
}

/**
 * 获取 USDC 合约地址
 */
function getUSDCAddress(network) {
  const addresses = {
    'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
    'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',        // Base Mainnet USDC
    'ethereum': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',    // Ethereum USDC
    'sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'     // Sepolia USDC
  };

  return addresses[network] || addresses['base-sepolia'];
}

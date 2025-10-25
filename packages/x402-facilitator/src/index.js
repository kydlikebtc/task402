/**
 * X402 Facilitator Server
 * 
 * 核心功能:
 * 1. 验证 EIP-3009 签名
 * 2. 代理创建托管支付
 * 3. 代理结算支付
 * 4. 管理 Gas 费用
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { createLogger, format, transports } from 'winston';

dotenv.config();

// ============ 配置 ============

const PORT = process.env.PORT || 3002;
const RPC_URL = process.env.HARDHAT_RPC_URL || 'http://localhost:8545';
const FACILITATOR_PRIVATE_KEY = process.env.FACILITATOR_PRIVATE_KEY;

// ============ 日志配置 ============

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

// ============ 区块链连接 ============

const provider = new ethers.JsonRpcProvider(RPC_URL);
const facilitatorWallet = new ethers.Wallet(FACILITATOR_PRIVATE_KEY || ethers.Wallet.createRandom().privateKey, provider);

logger.info('Facilitator 地址:', facilitatorWallet.address);

// ============ 合约 ABIs ============

const USDC_ABI = [
  "function name() view returns (string)",
  "function version() view returns (string)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
  "function balanceOf(address) view returns (uint256)",
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)"
];

const ESCROW_ABI = [
  "function createPaymentWithAuthorization(bytes32 paymentHash, address payer, address payee, address usdcAddress, uint256 amount, uint256 deadline, uint256 taskId, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "function settle(bytes32 paymentHash)",
  "function getPayment(bytes32 paymentHash) view returns (tuple(address payer, address payee, address token, uint256 amount, uint256 createdAt, uint256 deadline, uint8 status, uint256 taskId, bool disputed))"
];

// ============ Express App ============

const app = express();

app.use(cors());
app.use(express.json());

// ============ 中间件 - 请求日志 ============

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ============ 路由 ============

/**
 * GET /health - 健康检查
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    facilitator: facilitatorWallet.address,
    network: RPC_URL
  });
});

/**
 * GET /supported - 获取支持的网络
 */
app.get('/supported', async (req, res) => {
  try {
    const network = await provider.getNetwork();
    res.json({
      networks: [
        {
          chainId: Number(network.chainId),
          name: network.name || 'hardhat',
          rpcUrl: RPC_URL,
          facilitator: facilitatorWallet.address
        }
      ]
    });
  } catch (error) {
    logger.error('获取网络信息失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /verify - 验证 EIP-3009 签名
 * 
 * Body:
 * {
 *   usdcAddress: string,
 *   from: string,
 *   to: string,
 *   value: string,
 *   validAfter: number,
 *   validBefore: number,
 *   nonce: string,
 *   v: number,
 *   r: string,
 *   s: string
 * }
 */
app.post('/verify', async (req, res) => {
  try {
    const { usdcAddress, from, to, value, validAfter, validBefore, nonce, v, r, s } = req.body;

    // 验证必需参数
    if (!usdcAddress || !from || !to || !value || !nonce) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    logger.info('验证 EIP-3009 签名:', { from, to, value });

    // 连接 USDC 合约
    const usdc = new ethers.Contract(usdcAddress, USDC_ABI, provider);

    // 1. 检查余额
    const balance = await usdc.balanceOf(from);
    if (balance < BigInt(value)) {
      return res.status(400).json({
        error: 'Insufficient balance',
        balance: balance.toString(),
        required: value
      });
    }

    // 2. 检查 nonce 是否已使用
    const isNonceUsed = await usdc.authorizationState(from, nonce);
    if (isNonceUsed) {
      return res.status(400).json({ error: 'Nonce already used' });
    }

    // 3. 验证时间范围
    const now = Math.floor(Date.now() / 1000);
    if (now <= validAfter) {
      return res.status(400).json({ error: 'Authorization not yet valid' });
    }
    if (now >= validBefore) {
      return res.status(400).json({ error: 'Authorization expired' });
    }

    // 4. 恢复签名者地址
    const domain = {
      name: await usdc.name(),
      version: await usdc.version(),
      chainId: (await provider.getNetwork()).chainId,
      verifyingContract: usdcAddress
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

    const valueData = {
      from,
      to,
      value,
      validAfter,
      validBefore,
      nonce
    };

    // 使用 ethers.js 验证签名
    const signature = ethers.Signature.from({ v, r, s });
    const digest = ethers.TypedDataEncoder.hash(domain, types, valueData);
    const recoveredAddress = ethers.recoverAddress(digest, signature);

    // 5. 验证签名者
    if (recoveredAddress.toLowerCase() !== from.toLowerCase()) {
      return res.status(400).json({
        error: 'Invalid signature',
        expected: from,
        recovered: recoveredAddress
      });
    }

    logger.info('✅ 签名验证通过');

    res.json({
      valid: true,
      signer: recoveredAddress,
      balance: balance.toString()
    });

  } catch (error) {
    logger.error('签名验证失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /createPayment - 创建托管支付
 * 
 * Body:
 * {
 *   escrowAddress: string,
 *   paymentHash: string,
 *   payer: string,
 *   payee: string,
 *   usdcAddress: string,
 *   amount: string,
 *   deadline: number,
 *   taskId: number,
 *   validAfter: number,
 *   validBefore: number,
 *   nonce: string,
 *   v: number,
 *   r: string,
 *   s: string
 * }
 */
app.post('/createPayment', async (req, res) => {
  try {
    const {
      escrowAddress,
      paymentHash,
      payer,
      payee,
      usdcAddress,
      amount,
      deadline,
      taskId,
      validAfter,
      validBefore,
      nonce,
      v, r, s
    } = req.body;

    logger.info('创建托管支付:', { paymentHash, payer, amount });

    // 连接 Escrow 合约
    const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, facilitatorWallet);

    // 调用 createPaymentWithAuthorization
    const tx = await escrow.createPaymentWithAuthorization(
      paymentHash,
      payer,
      payee,
      usdcAddress,
      amount,
      deadline,
      taskId,
      validAfter,
      validBefore,
      nonce,
      v, r, s
    );

    logger.info('交易已提交:', tx.hash);

    // 等待确认
    const receipt = await tx.wait();

    logger.info('✅ 托管支付创建成功');

    res.json({
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    });

  } catch (error) {
    logger.error('创建支付失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /settle - 结算支付
 * 
 * Body:
 * {
 *   escrowAddress: string,
 *   paymentHash: string
 * }
 */
app.post('/settle', async (req, res) => {
  try {
    const { escrowAddress, paymentHash } = req.body;

    logger.info('结算支付:', { paymentHash });

    // 连接 Escrow 合约
    const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, facilitatorWallet);

    // 调用 settle
    const tx = await escrow.settle(paymentHash);

    logger.info('交易已提交:', tx.hash);

    // 等待确认
    const receipt = await tx.wait();

    logger.info('✅ 支付结算成功');

    res.json({
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    });

  } catch (error) {
    logger.error('结算失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ 错误处理 ============

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ============ 启动服务器 ============

app.listen(PORT, () => {
  logger.info(`🚀 X402 Facilitator Server running on port ${PORT}`);
  logger.info(`📍 Facilitator Address: ${facilitatorWallet.address}`);
  logger.info(`🌐 Network: ${RPC_URL}`);
});

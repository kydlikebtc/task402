import { ethers } from 'ethers';
import { logger } from './logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 区块链工具类 - 封装与智能合约的交互
 */
class BlockchainService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.taskRegistry = null;
    this.escrow = null;
    this.initialized = false;
  }

  /**
   * 初始化区块链连接
   */
  async initialize() {
    try {
      logger.info('初始化区块链连接...');

      // 连接到 RPC 节点
      const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
      this.provider = new ethers.JsonRpcProvider(rpcUrl);

      // 加载部署信息
      const network = process.env.NETWORK || 'localhost';
      const deploymentPath = path.join(
        __dirname,
        '../../../packages/contracts/deployments',
        `${network}.json`
      );

      if (!fs.existsSync(deploymentPath)) {
        throw new Error(`部署文件不存在: ${deploymentPath}`);
      }

      const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
      logger.info({
        message: '加载部署配置',
        network,
        taskRegistry: deployment.contracts.TaskRegistry.address,
        escrow: deployment.contracts.X402Escrow.address
      });

      // 加载合约 ABI
      const taskRegistryABI = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, '../../../packages/contracts/artifacts/contracts/TaskRegistry.sol/TaskRegistry.json'),
          'utf-8'
        )
      ).abi;

      const escrowABI = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, '../../../packages/contracts/artifacts/contracts/X402Escrow.sol/X402Escrow.json'),
          'utf-8'
        )
      ).abi;

      // 创建合约实例
      this.taskRegistry = new ethers.Contract(
        deployment.contracts.TaskRegistry.address,
        taskRegistryABI,
        this.provider
      );

      this.escrow = new ethers.Contract(
        deployment.contracts.X402Escrow.address,
        escrowABI,
        this.provider
      );

      // 如果有私钥，创建 signer（用于写操作）
      if (process.env.PRIVATE_KEY) {
        this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.taskRegistry = this.taskRegistry.connect(this.signer);
        this.escrow = this.escrow.connect(this.signer);
        logger.info({
          message: 'Signer 已配置',
          address: this.signer.address
        });
      } else {
        logger.warn('未配置 PRIVATE_KEY，仅支持只读操作');
      }

      this.initialized = true;
      logger.info('✅ 区块链连接初始化成功');

      return true;
    } catch (error) {
      logger.error({
        message: '区块链初始化失败',
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 确保已初始化
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('BlockchainService 未初始化，请先调用 initialize()');
    }
  }

  /**
   * 获取任务详情
   */
  async getTask(taskId) {
    this.ensureInitialized();
    try {
      logger.info({ message: '查询任务', taskId });
      const task = await this.taskRegistry.getTask(taskId);
      return this.formatTask(task);
    } catch (error) {
      logger.error({
        message: '获取任务失败',
        taskId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取开放任务列表
   */
  async getOpenTasks(limit = 10) {
    this.ensureInitialized();
    try {
      logger.info({ message: '查询开放任务', limit });
      const taskIds = await this.taskRegistry.getOpenTasks(limit);

      const tasks = await Promise.all(
        taskIds.map(id => this.getTask(id.toString()))
      );

      logger.info({ message: '开放任务查询成功', count: tasks.length });
      return tasks;
    } catch (error) {
      logger.error({
        message: '获取开放任务失败',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Agent 接单
   */
  async assignTask(taskId, agentAddress) {
    this.ensureInitialized();
    try {
      logger.info({
        message: 'Agent 接单',
        taskId,
        agentAddress
      });

      const tx = await this.taskRegistry.assignTask(taskId);
      const receipt = await tx.wait();

      logger.info({
        message: 'Agent 接单成功',
        taskId,
        txHash: receipt.hash
      });

      return {
        success: true,
        txHash: receipt.hash,
        taskId
      };
    } catch (error) {
      logger.error({
        message: 'Agent 接单失败',
        taskId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 提交任务结果
   */
  async submitTask(taskId, resultHash) {
    this.ensureInitialized();
    try {
      logger.info({
        message: '提交任务结果',
        taskId,
        resultHash
      });

      const tx = await this.taskRegistry.submitTask(taskId, resultHash);
      const receipt = await tx.wait();

      logger.info({
        message: '任务结果提交成功',
        taskId,
        resultHash,
        txHash: receipt.hash
      });

      return {
        success: true,
        txHash: receipt.hash,
        taskId,
        resultHash
      };
    } catch (error) {
      logger.error({
        message: '提交任务失败',
        taskId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 验证任务
   */
  async verifyTask(taskId, approved) {
    this.ensureInitialized();
    try {
      logger.info({
        message: '验证任务',
        taskId,
        approved
      });

      const tx = await this.taskRegistry.verifyTask(taskId, approved);
      const receipt = await tx.wait();

      logger.info({
        message: '任务验证完成',
        taskId,
        approved,
        txHash: receipt.hash
      });

      return {
        success: true,
        txHash: receipt.hash,
        taskId,
        approved
      };
    } catch (error) {
      logger.error({
        message: '验证任务失败',
        taskId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取 Agent 统计
   */
  async getAgentStats(agentAddress) {
    this.ensureInitialized();
    try {
      const stats = await this.taskRegistry.getAgentStats(agentAddress);
      return {
        reputation: stats.reputation.toString(),
        completedTasks: stats.completedTasks.toString()
      };
    } catch (error) {
      logger.error({
        message: '获取 Agent 统计失败',
        agentAddress,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 格式化任务对象
   */
  formatTask(task) {
    return {
      taskId: task.taskId.toString(),
      creator: task.creator,
      description: task.description,
      reward: ethers.formatEther(task.reward),
      rewardToken: task.rewardToken,
      deadline: new Date(Number(task.deadline) * 1000).toISOString(),
      status: this.getTaskStatusName(task.status),
      assignedAgent: task.assignedAgent,
      resultHash: task.resultHash,
      paymentHash: task.paymentHash,
      createdAt: new Date(Number(task.createdAt) * 1000).toISOString(),
      completedAt: task.completedAt > 0
        ? new Date(Number(task.completedAt) * 1000).toISOString()
        : null,
      category: this.getCategoryName(task.category)
    };
  }

  /**
   * 获取任务状态名称
   */
  getTaskStatusName(status) {
    const statuses = ['Open', 'Assigned', 'Submitted', 'Verified', 'Completed', 'Cancelled', 'Disputed'];
    return statuses[status] || 'Unknown';
  }

  /**
   * 获取分类名称
   */
  getCategoryName(category) {
    const categories = ['DataAnalysis', 'ContentGeneration', 'CodeReview', 'Research', 'Translation', 'Other'];
    return categories[category] || 'Other';
  }
}

// 导出单例
export const blockchainService = new BlockchainService();

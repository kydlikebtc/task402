import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { blockchainService } from '../utils/blockchain.js';

/**
 * AI Agent 执行服务
 * 自动接单、执行任务、提交结果
 */
class AgentExecutorService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.agentAddress = process.env.AGENT_ADDRESS || null;
    this.isRunning = false;
    this.executingTasks = new Set();
  }

  /**
   * 启动 Agent 自动执行器
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Agent executor is already running');
      return;
    }

    if (!this.agentAddress) {
      logger.error('AGENT_ADDRESS not configured');
      throw new Error('AGENT_ADDRESS not configured');
    }

    this.isRunning = true;
    logger.info({
      message: 'AI Agent Executor started',
      agentAddress: this.agentAddress
    });

    // 启动任务监听循环
    this.runTaskLoop();
  }

  /**
   * 停止 Agent 执行器
   */
  stop() {
    this.isRunning = false;
    logger.info('AI Agent Executor stopped');
  }

  /**
   * 任务监听循环
   */
  async runTaskLoop() {
    while (this.isRunning) {
      try {
        await this.checkAndExecuteTasks();
        // 每 30 秒检查一次新任务
        await this.sleep(30000);
      } catch (error) {
        logger.error({
          message: 'Task loop error',
          error: error.message,
          stack: error.stack
        });
        await this.sleep(60000); // 出错后等待 1 分钟
      }
    }
  }

  /**
   * 检查并执行任务
   */
  async checkAndExecuteTasks() {
    try {
      logger.info('Checking for new tasks...');

      // 获取开放任务
      const tasks = await blockchainService.getOpenTasks(5);

      logger.info({
        message: 'Found open tasks',
        count: tasks.length
      });

      for (const task of tasks) {
        // 检查是否已在执行
        if (this.executingTasks.has(task.taskId)) {
          continue;
        }

        // 检查任务是否适合（简单过滤）
        if (this.shouldAcceptTask(task)) {
          // 异步执行任务，避免阻塞
          this.executeTask(task).catch(error => {
            logger.error({
              message: 'Task execution failed',
              taskId: task.taskId,
              error: error.message
            });
          });
        }
      }
    } catch (error) {
      logger.error({
        message: 'Check tasks failed',
        error: error.message
      });
    }
  }

  /**
   * 判断是否接受任务
   */
  shouldAcceptTask(task) {
    // 检查截止时间（至少还有 1 小时）
    const deadline = new Date(task.deadline);
    const now = new Date();
    const hoursLeft = (deadline - now) / (1000 * 60 * 60);

    if (hoursLeft < 1) {
      logger.info({
        message: 'Task deadline too close',
        taskId: task.taskId,
        hoursLeft
      });
      return false;
    }

    // 检查奖励是否足够（至少 0.001 ETH）
    const reward = parseFloat(task.reward);
    if (reward < 0.001) {
      logger.info({
        message: 'Task reward too low',
        taskId: task.taskId,
        reward
      });
      return false;
    }

    // 检查任务类别（根据 Agent 能力过滤）
    const supportedCategories = [
      'DataAnalysis',
      'ContentGeneration',
      'Research',
      'Translation'
    ];

    if (!supportedCategories.includes(task.category)) {
      logger.info({
        message: 'Task category not supported',
        taskId: task.taskId,
        category: task.category
      });
      return false;
    }

    return true;
  }

  /**
   * 执行任务
   */
  async executeTask(task) {
    const taskId = task.taskId;
    this.executingTasks.add(taskId);

    try {
      logger.info({
        message: 'Starting task execution',
        taskId,
        description: task.description
      });

      // 1. 接单
      logger.info({ message: 'Assigning task', taskId });
      await blockchainService.assignTask(taskId, this.agentAddress);

      // 2. 执行任务（使用 AI）
      logger.info({ message: 'Executing task with AI', taskId });
      const result = await this.executeTaskWithAI(task);

      // 3. 生成结果哈希（实际应上传到 IPFS）
      const resultHash = this.generateResultHash(result);

      logger.info({
        message: 'Task execution completed',
        taskId,
        resultHash,
        resultPreview: result.substring(0, 100)
      });

      // 4. 提交结果
      logger.info({ message: 'Submitting task result', taskId });
      await blockchainService.submitTask(taskId, resultHash);

      logger.info({
        message: 'Task submitted successfully',
        taskId,
        resultHash
      });

      // 等待验证（实际应该监听事件）
      // 这里简化处理
      setTimeout(() => {
        logger.info({
          message: 'Task completed',
          taskId,
          status: 'awaiting_verification'
        });
      }, 5000);

    } catch (error) {
      logger.error({
        message: 'Task execution error',
        taskId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      this.executingTasks.delete(taskId);
    }
  }

  /**
   * 使用 AI 执行任务
   */
  async executeTaskWithAI(task) {
    try {
      const prompt = this.buildTaskPrompt(task);

      logger.info({
        message: 'Calling OpenAI for task execution',
        taskId: task.taskId,
        category: task.category
      });

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(task.category)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const result = response.choices[0].message.content.trim();

      logger.info({
        message: 'AI task execution completed',
        taskId: task.taskId,
        resultLength: result.length,
        tokensUsed: response.usage.total_tokens
      });

      return result;
    } catch (error) {
      logger.error({
        message: 'AI execution failed',
        taskId: task.taskId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 构建任务提示词
   */
  buildTaskPrompt(task) {
    return `
Task ID: ${task.taskId}
Category: ${task.category}
Description: ${task.description}
Reward: ${task.reward} ETH
Deadline: ${task.deadline}

Please complete this task according to the description above.
Provide a comprehensive and high-quality result.
    `.trim();
  }

  /**
   * 获取系统提示词（根据任务类别）
   */
  getSystemPrompt(category) {
    const prompts = {
      DataAnalysis: 'You are a data analysis expert. Analyze data thoroughly and provide actionable insights.',
      ContentGeneration: 'You are a professional content creator. Create engaging and high-quality content.',
      Research: 'You are a research specialist. Conduct thorough research and provide well-structured findings.',
      Translation: 'You are a professional translator. Provide accurate and natural translations.',
      CodeReview: 'You are a senior software engineer. Review code and provide constructive feedback.',
      Other: 'You are a versatile AI assistant. Complete tasks with high quality and attention to detail.'
    };

    return prompts[category] || prompts.Other;
  }

  /**
   * 生成结果哈希
   * TODO: 实际应该上传到 IPFS 并返回 CID
   */
  generateResultHash(result) {
    // 简化版：使用时间戳 + 结果摘要
    const timestamp = Date.now();
    const preview = result.substring(0, 50);
    return `QmMock${timestamp}_${Buffer.from(preview).toString('base64').substring(0, 20)}`;
  }

  /**
   * 工具函数：睡眠
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取 Agent 统计
   */
  async getStats() {
    try {
      const stats = await blockchainService.getAgentStats(this.agentAddress);
      return {
        address: this.agentAddress,
        isRunning: this.isRunning,
        executingTasks: Array.from(this.executingTasks),
        ...stats
      };
    } catch (error) {
      logger.error({
        message: 'Get agent stats failed',
        error: error.message
      });
      return {
        address: this.agentAddress,
        isRunning: this.isRunning,
        executingTasks: Array.from(this.executingTasks),
        error: error.message
      };
    }
  }
}

// 导出单例
export const agentExecutorService = new AgentExecutorService();

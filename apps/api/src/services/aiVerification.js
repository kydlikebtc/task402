import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

/**
 * AI 验证服务 - 使用 LLM 验证任务结果质量
 */
class AIVerificationService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * 验证任务结果
   * @param {Object} task - 任务对象
   * @param {string} resultHash - 结果哈希（IPFS CID）
   * @returns {boolean} 是否通过验证
   */
  async verifyTaskResult(task, resultHash) {
    try {
      logger.info({
        message: 'AI 验证任务结果',
        taskId: task.taskId,
        resultHash,
        category: task.category
      });

      // TODO: 从 IPFS 获取实际结果内容
      // 这里简化处理，假设 resultHash 就是结果内容的摘要
      const resultContent = `Result hash: ${resultHash}`;

      // 构造验证提示词
      const prompt = this.buildVerificationPrompt(task, resultContent);

      // 调用 GPT 进行验证
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a task verification AI. You need to verify if the task result meets the requirements. Respond with ONLY "APPROVED" or "REJECTED" followed by a brief reason.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 200
      });

      const verificationResult = response.choices[0].message.content.trim();

      logger.info({
        message: 'AI 验证完成',
        taskId: task.taskId,
        verificationResult
      });

      // 判断是否通过
      const approved = verificationResult.toUpperCase().startsWith('APPROVED');

      logger.info({
        message: 'AI 验证判定',
        taskId: task.taskId,
        approved,
        reason: verificationResult
      });

      return approved;
    } catch (error) {
      logger.error({
        message: 'AI 验证失败',
        taskId: task.taskId,
        error: error.message
      });

      // 验证失败时默认拒绝
      return false;
    }
  }

  /**
   * 构建验证提示词
   */
  buildVerificationPrompt(task, resultContent) {
    return `
Task ID: ${task.taskId}
Category: ${task.category}
Description: ${task.description}
Deadline: ${task.deadline}

Submitted Result:
${resultContent}

Please verify if this result adequately completes the task described above.
Consider:
1. Does it address the task description?
2. Is it complete and of acceptable quality?
3. Was it submitted before the deadline?

Respond with APPROVED or REJECTED and a brief reason.
    `.trim();
  }

  /**
   * 批量验证（用于定时任务）
   */
  async batchVerify(tasks) {
    const results = await Promise.allSettled(
      tasks.map(task => this.verifyTaskResult(task, task.resultHash))
    );

    logger.info({
      message: '批量验证完成',
      total: tasks.length,
      approved: results.filter(r => r.status === 'fulfilled' && r.value === true).length,
      rejected: results.filter(r => r.status === 'fulfilled' && r.value === false).length,
      errors: results.filter(r => r.status === 'rejected').length
    });

    return results;
  }
}

export const aiVerificationService = new AIVerificationService();

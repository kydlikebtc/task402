/**
 * 交易服务 - 调用 TaskRegistry 创建任务
 */

import { ethers } from 'ethers';
import { CreateTaskRequest, FacilitatorConfig } from '../types';
import { verifyEIP3009Signature } from './signature';

// TaskRegistry ABI (仅需要的函数)
const TASK_REGISTRY_ABI = [
  'function createTaskWithEIP3009(address creator, string memory description, uint256 reward, uint256 deadline, uint8 category, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external returns (uint256 taskId)',
  'event TaskCreated(uint256 indexed taskId, address indexed creator, uint256 reward, uint256 deadline)',
];

/**
 * 执行创建任务交易
 */
export async function executeCreateTask(
  request: CreateTaskRequest,
  config: FacilitatorConfig
): Promise<{ success: boolean; taskId?: number; txHash?: string; gasUsed?: string; error?: string }> {
  try {
    // 1. 连接 provider 和 wallet
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const wallet = new ethers.Wallet(config.privateKey, provider);

    console.log(`[Transaction] Facilitator wallet: ${wallet.address}`);

    // 2. 验证签名
    const reward = BigInt(request.reward);

    const verification = await verifyEIP3009Signature(
      config.contracts.usdc,
      config.chainId,
      request.creator,
      config.contracts.escrow,
      reward,
      request.signature,
      provider
    );

    if (!verification.valid) {
      console.error(`[Transaction] Signature verification failed: ${verification.error}`);
      return { success: false, error: verification.error };
    }

    console.log('[Transaction] Signature verified successfully');

    // 3. 检查 Gas 价格
    const feeData = await provider.getFeeData();
    const currentGasPrice = feeData.gasPrice || 0n;
    const maxGasPrice = ethers.parseUnits(config.gasLimit.maxGasPrice, 'gwei');

    if (currentGasPrice > maxGasPrice) {
      const currentGwei = ethers.formatUnits(currentGasPrice, 'gwei');
      return {
        success: false,
        error: `Gas price too high: ${currentGwei} gwei (max: ${config.gasLimit.maxGasPrice} gwei)`,
      };
    }

    const gasPriceGwei = ethers.formatUnits(currentGasPrice, 'gwei');
    console.log(`[Transaction] Gas price: ${gasPriceGwei} gwei`);

    // 4. 连接 TaskRegistry 合约
    const taskRegistry = new ethers.Contract(
      config.contracts.taskRegistry,
      TASK_REGISTRY_ABI,
      wallet
    );

    // 5. 调用 createTaskWithEIP3009
    console.log('[Transaction] Sending createTaskWithEIP3009 transaction...');

    const tx = await taskRegistry.createTaskWithEIP3009(
      request.creator,
      request.description,
      reward,
      request.deadline,
      request.category,
      request.signature.validAfter,
      request.signature.validBefore,
      request.signature.nonce,
      request.signature.v,
      request.signature.r,
      request.signature.s,
      {
        gasLimit: config.gasLimit.maxGasLimit,
      }
    );

    console.log(`[Transaction] Transaction sent: ${tx.hash}`);

    // 6. 等待交易确认
    const receipt = await tx.wait();

    console.log(`[Transaction] Transaction confirmed in block ${receipt.blockNumber}`);

    // 7. 从事件中提取 taskId
    let taskId: number | undefined;

    for (const log of receipt.logs) {
      try {
        const parsed = taskRegistry.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });

        if (parsed && parsed.name === 'TaskCreated') {
          taskId = Number(parsed.args.taskId);
          console.log(`[Transaction] Task created with ID: ${taskId}`);
          break;
        }
      } catch (e) {
        // 忽略无法解析的日志
      }
    }

    return {
      success: true,
      taskId,
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
    };

  } catch (error: any) {
    console.error('[Transaction] Error:', error);
    return {
      success: false,
      error: error.message || 'Transaction failed',
    };
  }
}

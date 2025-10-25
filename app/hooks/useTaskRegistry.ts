/**
 * TaskRegistry 合约交互 Hook
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import TaskRegistryABI from '../lib/abis/TaskRegistry.json';
import config from '../lib/config.json';

export function useTaskRegistry() {
  const contractAddress = config.contracts.taskRegistry as `0x${string}`;

  // 写入合约
  const { data: hash, isPending: isWritePending, writeContract } = useWriteContract();

  // 等待交易确认
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  /**
   * 读取单个任务
   */
  const useTask = (taskId: number) => {
    return useReadContract({
      address: contractAddress,
      abi: TaskRegistryABI,
      functionName: 'tasks',
      args: [taskId],
    });
  };

  /**
   * 创建 ETH 任务
   */
  const createTask = async (
    description: string,
    reward: bigint,
    rewardToken: `0x${string}`,
    deadline: number,
    category: number
  ) => {
    return writeContract({
      address: contractAddress,
      abi: TaskRegistryABI,
      functionName: 'createTask',
      args: [description, reward, rewardToken, deadline, category],
    });
  };

  /**
   * 创建 USDC 任务 (使用 EIP-3009)
   */
  const createTaskWithUSDC = async (
    description: string,
    reward: bigint,
    deadline: number,
    category: number,
    validAfter: number,
    validBefore: number,
    nonce: `0x${string}`,
    v: number,
    r: `0x${string}`,
    s: `0x${string}`
  ) => {
    return writeContract({
      address: contractAddress,
      abi: TaskRegistryABI,
      functionName: 'createTaskWithUSDC',
      args: [description, reward, deadline, category, validAfter, validBefore, nonce, v, r, s],
    });
  };

  /**
   * Agent 接取 ETH 任务
   */
  const assignTask = async (taskId: number, stakeAmount: bigint) => {
    return writeContract({
      address: contractAddress,
      abi: TaskRegistryABI,
      functionName: 'assignTask',
      args: [taskId],
      value: stakeAmount,
    });
  };

  /**
   * Agent 接取 USDC 任务
   */
  const assignTaskWithUSDC = async (taskId: number, stakeAmount: bigint) => {
    return writeContract({
      address: contractAddress,
      abi: TaskRegistryABI,
      functionName: 'assignTaskWithUSDC',
      args: [taskId, stakeAmount],
    });
  };

  /**
   * Agent 提交任务结果
   */
  const submitTask = async (taskId: number, resultHash: string) => {
    return writeContract({
      address: contractAddress,
      abi: TaskRegistryABI,
      functionName: 'submitTask',
      args: [taskId, resultHash],
    });
  };

  /**
   * Verifier 验证任务
   */
  const verifyTask = async (taskId: number, approved: boolean) => {
    return writeContract({
      address: contractAddress,
      abi: TaskRegistryABI,
      functionName: 'verifyTask',
      args: [taskId, approved],
    });
  };

  /**
   * 读取质押百分比
   */
  const useStakePercentage = () => {
    return useReadContract({
      address: contractAddress,
      abi: TaskRegistryABI,
      functionName: 'stakePercentage',
    });
  };

  /**
   * 读取平台地址
   */
  const usePlatformAddress = () => {
    return useReadContract({
      address: contractAddress,
      abi: TaskRegistryABI,
      functionName: 'platformAddress',
    });
  };

  return {
    // 读取方法
    useTask,
    useStakePercentage,
    usePlatformAddress,

    // 写入方法
    createTask,
    createTaskWithUSDC,
    assignTask,
    assignTaskWithUSDC,
    submitTask,
    verifyTask,

    // 交易状态
    hash,
    isWritePending,
    isConfirming,
    isConfirmed,
  };
}

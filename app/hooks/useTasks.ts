/**
 * 批量读取任务的 Hook
 * 由于合约没有批量读取接口,这里通过遍历 taskId 来读取多个任务
 */

import { useReadContracts } from 'wagmi';
import TaskRegistryABI from '../lib/abis/TaskRegistry.json';
import config from '../lib/config.json';

export interface Task {
  taskId: number;
  creator: string;
  description: string;
  reward: bigint;
  rewardToken: string;
  deadline: number;
  status: number;
  assignedAgent: string;
  resultHash: string;
  paymentHash: string;
  createdAt: number;
  completedAt: number;
  category: number;
  stakeAmount: bigint;
  stakeRefunded: boolean;
}

/**
 * 读取多个任务
 * @param taskIds 要读取的任务 ID 数组
 */
export function useTasks(taskIds: number[]) {
  const contractAddress = config.contracts.taskRegistry as `0x${string}`;

  const contracts = taskIds.map((taskId) => ({
    address: contractAddress,
    abi: TaskRegistryABI,
    functionName: 'tasks',
    args: [taskId],
  }));

  const { data, isError, isLoading, refetch } = useReadContracts({
    contracts,
  });

  // 转换数据格式
  const tasks: Task[] = [];
  if (data) {
    data.forEach((result, index) => {
      if (result.status === 'success' && result.result) {
        const taskData = result.result as any;

        // 过滤掉空任务 (creator 为 0x0)
        if (taskData[1] !== '0x0000000000000000000000000000000000000000') {
          tasks.push({
            taskId: taskIds[index],
            creator: taskData[1] as string,
            description: taskData[2] as string,
            reward: taskData[3] as bigint,
            rewardToken: taskData[4] as string,
            deadline: Number(taskData[5]),
            status: Number(taskData[6]),
            assignedAgent: taskData[7] as string,
            resultHash: taskData[8] as string,
            paymentHash: taskData[9] as string,
            createdAt: Number(taskData[10]),
            completedAt: Number(taskData[11]),
            category: Number(taskData[12]),
            stakeAmount: taskData[13] as bigint,
            stakeRefunded: taskData[14] as boolean,
          });
        }
      }
    });
  }

  return {
    tasks,
    isLoading,
    isError,
    refetch,
  };
}

/**
 * 读取单个任务
 * @param taskId 任务 ID
 */
export function useTask(taskId: number) {
  const { tasks, isLoading, isError, refetch } = useTasks([taskId]);

  return {
    task: tasks[0] || null,
    isLoading,
    isError,
    refetch,
  };
}

/**
 * 读取用户创建的任务
 * @param creator 创建者地址
 * @param maxTaskId 最大任务 ID (从 1 到 maxTaskId)
 */
export function useTasksByCreator(creator?: string, maxTaskId: number = 10) {
  const taskIds = Array.from({ length: maxTaskId }, (_, i) => i + 1);
  const { tasks, isLoading, isError, refetch } = useTasks(taskIds);

  // 过滤出指定创建者的任务
  const creatorTasks = creator
    ? tasks.filter((task) => task.creator.toLowerCase() === creator.toLowerCase())
    : [];

  return {
    tasks: creatorTasks,
    isLoading,
    isError,
    refetch,
  };
}

/**
 * 读取用户接取的任务
 * @param agent Agent 地址
 * @param maxTaskId 最大任务 ID
 */
export function useTasksByAgent(agent?: string, maxTaskId: number = 10) {
  const taskIds = Array.from({ length: maxTaskId }, (_, i) => i + 1);
  const { tasks, isLoading, isError, refetch } = useTasks(taskIds);

  // 过滤出指定 Agent 的任务
  const agentTasks = agent
    ? tasks.filter((task) => task.assignedAgent.toLowerCase() === agent.toLowerCase())
    : [];

  return {
    tasks: agentTasks,
    isLoading,
    isError,
    refetch,
  };
}

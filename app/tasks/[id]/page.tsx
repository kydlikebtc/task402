'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { ethers } from 'ethers';
import { useParams, useRouter } from 'next/navigation';
import { useTask } from '../../hooks/useTasks';
import { useTaskRegistry } from '../../hooks/useTaskRegistry';
import { useUSDC } from '../../hooks/useUSDC';
import config from '../../lib/config.json';

// 任务分类
const TASK_CATEGORIES = [
  '数据分析',
  '内容创作',
  '代码开发',
  '研究报告',
  '其他',
];

// 任务状态
const TASK_STATUS = [
  '待接取',
  '进行中',
  '待验证',
  '已完成',
  '已取消',
];

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = parseInt(params?.id as string);

  const { address, isConnected } = useAccount();
  const [resultHash, setResultHash] = useState('');

  // 从合约读取任务
  const { task, isLoading, isError, refetch } = useTask(taskId);

  // 合约交互 hooks
  const {
    assignTaskWithUSDC,
    submitTask,
    isWritePending,
    isConfirming,
    isConfirmed,
  } = useTaskRegistry();

  const { approve, useBalance, contractAddress: usdcAddress } = useUSDC();

  // 读取用户 USDC 余额
  const { data: usdcBalance } = useBalance(address);

  // Agent 接取任务
  const handleAcceptTask = async () => {
    if (!isConnected || !task) {
      alert('请先连接钱包');
      return;
    }

    try {
      // 计算质押金额 (20% of reward)
      const stakeAmount = (task.reward * 20n) / 100n;

      // 检查余额
      if (usdcBalance && usdcBalance < stakeAmount) {
        alert(`USDC 余额不足。需要: ${ethers.formatUnits(stakeAmount, 6)} USDC, 当前: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
        return;
      }

      // 1. 先授权 USDC
      console.log('步骤 1: 授权 USDC...');
      await approve(config.contracts.taskRegistry as `0x${string}`, stakeAmount);

      // 等待授权确认
      if (isConfirmed) {
        console.log('✅ USDC 授权成功');

        // 2. 接取任务
        console.log('步骤 2: 接取任务...');
        await assignTaskWithUSDC(taskId, stakeAmount);

        // 等待交易确认
        if (isConfirmed) {
          console.log('✅ 接取任务成功!');
          alert('接取任务成功!');
          refetch(); // 刷新任务数据
        }
      }
    } catch (err: any) {
      console.error('接取任务失败:', err);
      alert(`接取任务失败: ${err.message || '未知错误'}`);
    }
  };

  // Agent 提交结果
  const handleSubmitResult = async () => {
    if (!isConnected || !task) {
      alert('请先连接钱包');
      return;
    }

    if (!resultHash.trim()) {
      alert('请输入结果哈希');
      return;
    }

    try {
      console.log('提交结果:', resultHash);
      await submitTask(taskId, resultHash);

      if (isConfirmed) {
        console.log('✅ 提交结果成功!');
        alert('提交结果成功!');
        setResultHash('');
        refetch(); // 刷新任务数据
      }
    } catch (err: any) {
      console.error('提交结果失败:', err);
      alert(`提交结果失败: ${err.message || '未知错误'}`);
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  // 格式化地址
  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-500 dark:text-gray-400">加载中...</p>
          </div>
        </div>
      </main>
    );
  }

  if (isError || !task) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
            <p className="text-red-800 dark:text-red-400">
              ❌ {isError ? '加载任务失败' : '任务不存在'}
            </p>
            <Link
              href="/tasks"
              className="mt-4 inline-block px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
            >
              返回列表
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isCreator = isConnected && address?.toLowerCase() === task.creator.toLowerCase();
  const isAgent = isConnected && address?.toLowerCase() === task.assignedAgent.toLowerCase();
  const canAccept = isConnected && task.status === 0 && !isCreator;
  const canSubmit = isAgent && task.status === 1;

  // 计算质押金额
  const stakeAmount = (task.reward * 20n) / 100n;

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* 导航栏 */}
      <nav className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link href="/">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent cursor-pointer">
                  Task402
                </h1>
              </Link>
              <div className="hidden md:flex space-x-4">
                <Link href="/tasks" className="text-blue-600 dark:text-blue-400 px-3 py-2 rounded-md text-sm font-medium">
                  浏览任务
                </Link>
                <Link href="/create" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium">
                  发布任务
                </Link>
                <Link href="/dashboard" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium">
                  我的任务
                </Link>
              </div>
            </div>
            <ConnectButton />
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 返回按钮 */}
        <Link
          href="/tasks"
          className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-6"
        >
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回列表
        </Link>

        {/* 任务详情卡片 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex space-x-3">
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium">
                {TASK_CATEGORIES[task.category]}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                task.status === 0
                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300'
                  : task.status === 1 || task.status === 2
                  ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
              }`}>
                {TASK_STATUS[task.status]}
              </span>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {ethers.formatUnits(task.reward, 6)} USDC
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                质押: {ethers.formatUnits(stakeAmount, 6)} USDC (20%)
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            任务 #{task.taskId}
          </h2>

          <div className="prose dark:prose-invert max-w-none mb-6">
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {task.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t dark:border-gray-700 pt-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">发布者</p>
              <p className="text-gray-900 dark:text-white font-mono text-sm">
                {formatAddress(task.creator)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">创建时间</p>
              <p className="text-gray-900 dark:text-white text-sm">
                {formatTime(task.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">截止时间</p>
              <p className="text-gray-900 dark:text-white text-sm">
                {formatTime(task.deadline)}
              </p>
            </div>
            {task.assignedAgent !== ethers.ZeroAddress && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">接取者</p>
                <p className="text-gray-900 dark:text-white font-mono text-sm">
                  {formatAddress(task.assignedAgent)}
                </p>
              </div>
            )}
          </div>

          {/* 用户 USDC 余额 */}
          {isConnected && usdcBalance !== undefined && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-400">
                💰 您的 USDC 余额: {ethers.formatUnits(usdcBalance, 6)} USDC
              </p>
            </div>
          )}
        </div>

        {/* 操作区域 */}
        {canAccept && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              接取任务
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              接取此任务需要质押 {ethers.formatUnits(stakeAmount, 6)} USDC (奖励金额的 20%)。
              完成任务后,质押将全额退还。
            </p>
            <button
              type="button"
              onClick={handleAcceptTask}
              disabled={isWritePending || isConfirming}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md font-medium transition-colors disabled:cursor-not-allowed"
            >
              {isWritePending || isConfirming
                ? '处理中...'
                : `接取任务 (质押 ${ethers.formatUnits(stakeAmount, 6)} USDC)`}
            </button>
            {isConfirmed && (
              <p className="mt-2 text-green-600 dark:text-green-400 text-sm text-center">
                ✅ 交易成功!
              </p>
            )}
          </div>
        )}

        {canSubmit && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              提交结果
            </h3>
            <div className="mb-4">
              <label htmlFor="resultHash" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                结果哈希 (IPFS CID 或其他链接)
              </label>
              <input
                type="text"
                id="resultHash"
                value={resultHash}
                onChange={(e) => setResultHash(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="例如: ipfs://QmXXX... 或 https://..."
              />
            </div>
            <button
              type="button"
              onClick={handleSubmitResult}
              disabled={isWritePending || isConfirming || !resultHash.trim()}
              className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md font-medium transition-colors disabled:cursor-not-allowed"
            >
              {isWritePending || isConfirming ? '提交中...' : '提交结果'}
            </button>
            {isConfirmed && (
              <p className="mt-2 text-green-600 dark:text-green-400 text-sm text-center">
                ✅ 提交成功!
              </p>
            )}
          </div>
        )}

        {!isConnected && task.status === 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
            <p className="text-yellow-800 dark:text-yellow-400 mb-3">
              请先连接钱包才能接取任务
            </p>
            <ConnectButton />
          </div>
        )}

        {isCreator && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <p className="text-blue-800 dark:text-blue-400 text-center">
              ℹ️ 这是您创建的任务,无法自己接取
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

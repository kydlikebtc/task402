'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { ethers } from 'ethers';
import { useTasksByCreator, useTasksByAgent } from '../hooks/useTasks';

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

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'created' | 'accepted'>('created');

  // 从合约读取用户任务 (读取任务 ID 1-20)
  const { tasks: createdTasks } = useTasksByCreator(address, 20);
  const { tasks: acceptedTasks } = useTasksByAgent(address, 20);

  // 判断是否加载中 (如果用户已连接但两个列表都为空,可能还在加载)
  const loading = isConnected && createdTasks.length === 0 && acceptedTasks.length === 0;

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  const formatDeadline = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return '已过期';
    if (days === 0) return '今天';
    if (days === 1) return '明天';
    return `${days} 天后`;
  };

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  if (!isConnected) {
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
              </div>
              <ConnectButton />
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-12 text-center">
            <svg className="mx-auto h-16 w-16 text-yellow-600 dark:text-yellow-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-yellow-800 dark:text-yellow-400 text-lg mb-4">
              请先连接钱包查看您的任务
            </p>
            <ConnectButton />
          </div>
        </div>
      </main>
    );
  }

  const currentTasks = activeTab === 'created' ? createdTasks : acceptedTasks;

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
                <Link href="/tasks" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium">
                  浏览任务
                </Link>
                <Link href="/create" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium">
                  发布任务
                </Link>
                <Link href="/dashboard" className="text-blue-600 dark:text-blue-400 px-3 py-2 rounded-md text-sm font-medium border-b-2 border-blue-600">
                  我的任务
                </Link>
              </div>
            </div>
            <ConnectButton />
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              我的任务
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              管理您创建和接取的所有任务
            </p>
          </div>
          <Link
            href="/create"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
          >
            + 发布新任务
          </Link>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900 rounded-md p-3">
                <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {createdTasks.length}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  创建的任务
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 dark:bg-green-900 rounded-md p-3">
                <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {acceptedTasks.length}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  接取的任务
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 dark:bg-purple-900 rounded-md p-3">
                <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {acceptedTasks.reduce((sum, task) => {
                    // 计算实际收益 = 奖励 * (1 - 0.015 - 0.005) = 奖励 * 0.98
                    const rewardInUsdc = parseFloat(ethers.formatUnits(task.reward, 6));
                    const netReward = rewardInUsdc * 0.98;
                    return sum + netReward;
                  }, 0).toFixed(2)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  潜在收益 (USDC)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 任务标签 */}
        <div className="flex space-x-2 mb-6">
          <button
            onClick={() => setActiveTab('created')}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'created'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            我创建的 ({createdTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('accepted')}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'accepted'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            我接取的 ({acceptedTasks.length})
          </button>
        </div>

        {/* 任务列表 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-500 dark:text-gray-400">加载中...</p>
          </div>
        ) : currentTasks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              {activeTab === 'created' ? '您还没有创建任务' : '您还没有接取任务'}
            </p>
            <Link
              href={activeTab === 'created' ? '/create' : '/tasks'}
              className="mt-4 inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
            >
              {activeTab === 'created' ? '发布任务' : '浏览任务'}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {currentTasks.map((task) => (
              <Link
                key={task.taskId}
                href={`/tasks/${task.taskId}`}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
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
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {task.description}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {activeTab === 'created'
                        ? `Agent: ${task.assignedAgent !== ethers.ZeroAddress ? formatAddress(task.assignedAgent) : '待接取'}`
                        : `Creator: ${formatAddress(task.creator)}`
                      }
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {ethers.formatUnits(task.reward, 6)} USDC
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      截止: {formatDeadline(task.deadline)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

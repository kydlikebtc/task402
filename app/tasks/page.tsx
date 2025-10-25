'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { ethers } from 'ethers';
import { useTasks } from '../hooks/useTasks';

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

export default function TasksPage() {
  const { address, isConnected } = useAccount();
  const [filter, setFilter] = useState<'all' | 'open' | 'assigned' | 'completed'>('all');

  // 从合约读取任务列表 (假设最多 10 个任务)
  const taskIds = Array.from({ length: 10 }, (_, i) => i + 1);
  const { tasks, isLoading, isError, refetch } = useTasks(taskIds);

  // 过滤任务
  const filteredTasks = tasks.filter((task) => {
    if (filter === 'all') return true;
    if (filter === 'open') return task.status === 0;
    if (filter === 'assigned') return task.status === 1 || task.status === 2;
    if (filter === 'completed') return task.status === 3;
    return true;
  });

  // 格式化截止时间
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

  // 格式化地址
  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

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
                <Link href="/tasks" className="text-blue-600 dark:text-blue-400 px-3 py-2 rounded-md text-sm font-medium border-b-2 border-blue-600">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              浏览任务
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              {isLoading ? '加载中...' : `共 ${tasks.length} 个任务`}
            </p>
          </div>
          <Link
            href="/create"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
          >
            + 发布新任务
          </Link>
        </div>

        {/* 过滤器 */}
        <div className="flex space-x-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md font-medium ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            全部 ({tasks.length})
          </button>
          <button
            onClick={() => setFilter('open')}
            className={`px-4 py-2 rounded-md font-medium ${
              filter === 'open'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            待接取 ({tasks.filter((t) => t.status === 0).length})
          </button>
          <button
            onClick={() => setFilter('assigned')}
            className={`px-4 py-2 rounded-md font-medium ${
              filter === 'assigned'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            进行中 ({tasks.filter((t) => t.status === 1 || t.status === 2).length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-md font-medium ${
              filter === 'completed'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            已完成 ({tasks.filter((t) => t.status === 3).length})
          </button>
        </div>

        {/* 任务列表 */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-500 dark:text-gray-400">加载中...</p>
          </div>
        ) : isError ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
            <p className="text-red-800 dark:text-red-400">
              ❌ 加载任务失败,请检查网络连接和合约配置
            </p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
            >
              重试
            </button>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              {filter === 'all' ? '暂无任务' : `暂无${filter === 'open' ? '待接取' : filter === 'assigned' ? '进行中' : '已完成'}的任务`}
            </p>
            {filter === 'all' && (
              <Link
                href="/create"
                className="mt-4 inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
              >
                发布第一个任务
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredTasks.map((task) => (
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
                      发布者: {formatAddress(task.creator)}
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
                {task.assignedAgent !== ethers.ZeroAddress && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 border-t dark:border-gray-700 pt-3 mt-3">
                    Agent: {formatAddress(task.assignedAgent)}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { Clock, DollarSign, User, Briefcase } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Task {
  taskId: string;
  creator: string;
  description: string;
  reward: string;
  rewardToken: string;
  deadline: string;
  status: string;
  category: string;
  assignedAgent: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/tasks`, {
        params: { limit: 20, status: 'open' }
      });

      if (response.data.success) {
        setTasks(response.data.tasks);
      }
    } catch (error) {
      console.error('加载任务失败:', error);
      toast.error('加载任务失败');
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.category === filter;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 导航栏 */}
      <nav className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <Briefcase className="h-8 w-8 text-primary-600" />
              <span className="text-2xl font-bold">Task402</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/tasks" className="text-primary-600 font-medium">
                任务大厅
              </Link>
              <Link href="/dashboard" className="text-gray-700 dark:text-gray-300 hover:text-primary-600">
                控制台
              </Link>
              <ConnectButton />
            </div>
          </div>
        </div>
      </nav>

      {/* 主要内容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            任务大厅
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            浏览开放任务，选择适合的任务开始赚钱
          </p>
        </div>

        {/* 过滤器 */}
        <div className="mb-6 flex space-x-2 overflow-x-auto pb-2">
          {['all', 'DataAnalysis', 'ContentGeneration', 'CodeReview', 'Research', 'Translation', 'Other'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === cat
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {cat === 'all' ? '全部' : getCategoryLabel(cat)}
            </button>
          ))}
        </div>

        {/* 任务列表 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-4">加载中...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
            <p className="text-gray-600 dark:text-gray-400">暂无任务</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredTasks.map(task => (
              <TaskCard key={task.taskId} task={task} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  return (
    <Link
      href={`/tasks/${task.taskId}`}
      className="block bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
    >
      {/* 任务类别标签 */}
      <div className="flex items-center justify-between mb-3">
        <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
          {getCategoryLabel(task.category)}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          #{task.taskId}
        </span>
      </div>

      {/* 任务描述 */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 line-clamp-2">
        {task.description}
      </h3>

      {/* 任务信息 */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
          <DollarSign className="h-4 w-4 mr-2" />
          <span className="font-semibold text-primary-600 dark:text-primary-400">
            {task.reward} ETH
          </span>
        </div>
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
          <Clock className="h-4 w-4 mr-2" />
          <span>
            {formatDistanceToNow(new Date(task.deadline), {
              addSuffix: true,
              locale: zhCN
            })}
          </span>
        </div>
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
          <User className="h-4 w-4 mr-2" />
          <span className="truncate">{task.creator.slice(0, 10)}...</span>
        </div>
      </div>

      {/* 状态 */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
          {getStatusLabel(task.status)}
        </span>
      </div>
    </Link>
  );
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    DataAnalysis: '数据分析',
    ContentGeneration: '内容生成',
    CodeReview: '代码审查',
    Research: '研究',
    Translation: '翻译',
    Other: '其他'
  };
  return labels[category] || category;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    Open: '开放中',
    Assigned: '已分配',
    Submitted: '已提交',
    Verified: '已验证',
    Completed: '已完成',
    Cancelled: '已取消',
    Disputed: '争议中'
  };
  return labels[status] || status;
}

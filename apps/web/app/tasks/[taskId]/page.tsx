'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface Task {
  taskId: string;
  creator: string;
  description: string;
  reward: string;
  deadline: number;
  status: string;
  assignedAgent?: string;
  resultHash?: string;
  category: string;
}

interface TaskResult {
  taskId: string;
  resultHash: string;
  submittedAt: number;
  verifiedAt?: number;
}

export default function TaskDetailPage() {
  const params = useParams();
  const { address, isConnected } = useAccount();
  const taskId = params.taskId as string;

  const [task, setTask] = useState<Task | null>(null);
  const [taskDescription, setTaskDescription] = useState<string>('');
  const [taskResult, setTaskResult] = useState<TaskResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [paymentSignature, setPaymentSignature] = useState<string>('');

  // 获取任务基本信息(免费)
  useEffect(() => {
    const fetchTask = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/tasks/${taskId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch task');
        }

        const data = await response.json();
        setTask(data.task);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (taskId) {
      fetchTask();
    }
  }, [taskId]);

  // 获取任务详情描述(需要 X402 支付 $0.001 USDC)
  const fetchTaskDescription = async () => {
    if (!paymentSignature) {
      setError('Please provide payment signature');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/tasks/${taskId}/description`, {
        headers: {
          'X-PAYMENT': paymentSignature
        }
      });

      if (response.status === 402) {
        const paymentRequired = await response.json();
        setError('Payment required: ' + JSON.stringify(paymentRequired.payment));
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch task description');
      }

      const data = await response.json();
      setTaskDescription(data.description);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 获取任务结果(需要 X402 支付 $0.005 USDC)
  const fetchTaskResult = async () => {
    if (!paymentSignature) {
      setError('Please provide payment signature');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/tasks/${taskId}/result`, {
        headers: {
          'X-PAYMENT': paymentSignature
        }
      });

      if (response.status === 402) {
        const paymentRequired = await response.json();
        setError('Payment required: ' + JSON.stringify(paymentRequired.payment));
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch task result');
      }

      const data = await response.json();
      setTaskResult(data);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 接单
  const handleAssignTask = async () => {
    if (!isConnected || !address) {
      setError('Please connect wallet first');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/tasks/${taskId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentAddress: address
        })
      });

      if (!response.ok) {
        throw new Error('Failed to assign task');
      }

      const data = await response.json();
      alert('Task assigned! Tx: ' + data.txHash);

      // 刷新任务信息
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !task) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">加载中...</div>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">任务不存在</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 任务基本信息 */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-3xl font-bold text-gray-900">
              任务 #{task.taskId}
            </h1>
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
              task.status === 'Open' ? 'bg-green-100 text-green-800' :
              task.status === 'Assigned' ? 'bg-blue-100 text-blue-800' :
              task.status === 'Submitted' ? 'bg-yellow-100 text-yellow-800' :
              task.status === 'Completed' ? 'bg-purple-100 text-purple-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {task.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-500">奖励</p>
              <p className="text-2xl font-bold text-indigo-600">{task.reward} USDC</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">截止时间</p>
              <p className="text-lg font-semibold">
                {new Date(task.deadline * 1000).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">创建者</p>
              <p className="text-sm font-mono">{task.creator.slice(0, 10)}...</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">分类</p>
              <p className="text-sm font-semibold">{task.category}</p>
            </div>
          </div>

          {task.assignedAgent && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-500">已分配给</p>
              <p className="text-sm font-mono">{task.assignedAgent}</p>
            </div>
          )}

          {/* 接单按钮 */}
          {task.status === 'Open' && isConnected && (
            <button
              onClick={handleAssignTask}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 font-semibold"
            >
              {loading ? '处理中...' : '接单'}
            </button>
          )}
        </div>

        {/* 任务详情描述(需要支付) */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            任务详情描述
            <span className="text-sm text-gray-500 ml-2">(需支付 $0.001 USDC)</span>
          </h2>

          {!taskDescription ? (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  此内容受 X402 协议保护,需要支付 $0.001 USDC 才能查看
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  支付签名 (EIP-3009)
                </label>
                <textarea
                  value={paymentSignature}
                  onChange={(e) => setPaymentSignature(e.target.value)}
                  placeholder='{"from":"0x...","to":"0x...","value":"1000",...}'
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm font-mono"
                  rows={4}
                />
              </div>

              <button
                onClick={fetchTaskDescription}
                disabled={loading || !paymentSignature}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold"
              >
                {loading ? '加载中...' : '查看任务详情'}
              </button>
            </div>
          ) : (
            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{taskDescription}</p>
            </div>
          )}
        </div>

        {/* 任务结果(需要支付,且任务必须已完成) */}
        {task.status === 'Completed' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              任务结果
              <span className="text-sm text-gray-500 ml-2">(需支付 $0.005 USDC)</span>
            </h2>

            {!taskResult ? (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    此内容受 X402 协议保护,需要支付 $0.005 USDC 才能查看
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    支付签名 (EIP-3009)
                  </label>
                  <textarea
                    value={paymentSignature}
                    onChange={(e) => setPaymentSignature(e.target.value)}
                    placeholder='{"from":"0x...","to":"0x...","value":"5000",...}'
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm font-mono"
                    rows={4}
                  />
                </div>

                <button
                  onClick={fetchTaskResult}
                  disabled={loading || !paymentSignature}
                  className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold"
                >
                  {loading ? '加载中...' : '查看任务结果'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">结果哈希</p>
                  <p className="text-sm font-mono break-all">{taskResult.resultHash}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">提交时间</p>
                  <p className="text-sm">
                    {new Date(taskResult.submittedAt * 1000).toLocaleString()}
                  </p>
                </div>
                {taskResult.verifiedAt && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-sm text-gray-500">验证时间</p>
                    <p className="text-sm">
                      {new Date(taskResult.verifiedAt * 1000).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ethers } from 'ethers';
import Link from 'next/link';
import { useTaskRegistry } from '../hooks/useTaskRegistry';
import { useUSDC } from '../hooks/useUSDC';
import { useWalletClient } from 'wagmi';
import { createEIP3009Authorization } from '../lib/eip3009/signer';
import config from '../lib/config.json';

// 任务分类
const TASK_CATEGORIES = [
  { id: 0, name: '数据分析', description: '数据分析、统计、可视化等' },
  { id: 1, name: '内容创作', description: '文章、图片、视频等内容创作' },
  { id: 2, name: '代码开发', description: '智能合约、DApp、工具开发等' },
  { id: 3, name: '研究报告', description: '行业研究、市场分析、技术调研等' },
  { id: 4, name: '其他', description: '其他类型任务' },
];

export default function CreateTask() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  // 使用 hooks
  const { createTask, isWritePending, isConfirming, isConfirmed } = useTaskRegistry();
  const { approve, useBalance } = useUSDC();
  const { data: usdcBalance } = useBalance(address);

  const [formData, setFormData] = useState({
    description: '',
    reward: '',
    deadline: '',
    category: 0,
  });

  const [step, setStep] = useState<'idle' | 'approving' | 'creating' | 'signing'>('idle');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ taskId: number } | null>(null);
  const [useZeroGas, setUseZeroGas] = useState(false);

  // 零 Gas 创建任务（使用 EIP-3009）
  const handleCreateWithZeroGas = async (rewardAmount: bigint, deadlineTimestamp: number) => {
    if (!walletClient || !address) {
      throw new Error('钱包未连接');
    }

    console.log('使用零 Gas 费创建任务（EIP-3009）...');
    setStep('signing');

    // 1. 创建 ethers Signer
    const provider = new ethers.BrowserProvider(walletClient);
    const signer = await provider.getSigner();

    // 2. 生成 EIP-3009 签名
    console.log('生成 EIP-3009 签名...');
    const signature = await createEIP3009Authorization(
      signer,
      config.contracts.usdc,
      config.chainId,
      config.contracts.escrow,
      rewardAmount
    );

    console.log('签名生成成功:', signature);

    // 3. 发送到 Facilitator 服务器
    setStep('creating');
    console.log('发送请求到 Facilitator...');

    const response = await fetch(`${config.facilitatorUrl}/api/v1/tasks/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: formData.description,
        reward: rewardAmount.toString(),
        deadline: deadlineTimestamp,
        category: formData.category,
        creator: address,
        signature,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Facilitator 请求失败');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '任务创建失败');
    }

    console.log('✅ 零 Gas 任务创建成功!', result);
    return result.taskId;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(null);

    if (!isConnected || !address) {
      setError('请先连接钱包');
      return;
    }

    try {
      // 验证表单
      if (!formData.description || !formData.reward || !formData.deadline) {
        throw new Error('请填写所有必填字段');
      }

      const rewardAmount = parseFloat(formData.reward);
      if (isNaN(rewardAmount) || rewardAmount <= 0) {
        throw new Error('奖励金额必须大于 0');
      }

      const deadlineTimestamp = Math.floor(new Date(formData.deadline).getTime() / 1000);
      if (deadlineTimestamp <= Math.floor(Date.now() / 1000)) {
        throw new Error('截止时间必须在未来');
      }

      // 转换奖励金额为 USDC 单位 (6 decimals)
      const reward = ethers.parseUnits(formData.reward, 6);

      // 检查 USDC 余额
      if (usdcBalance !== undefined && usdcBalance < reward) {
        throw new Error(`USDC 余额不足。需要: ${formData.reward} USDC, 当前: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
      }

      let taskId: number;

      if (useZeroGas) {
        // 使用零 Gas 模式 (EIP-3009)
        taskId = await handleCreateWithZeroGas(reward, deadlineTimestamp);
        console.log(`✅ 零 Gas 任务创建成功! Task ID: ${taskId}`);
      } else {
        // 标准模式（需要 Gas）
        // 步骤 1: 授权 USDC
        console.log('步骤 1: 授权 USDC...');
        setStep('approving');
        await approve(config.contracts.taskRegistry as `0x${string}`, reward);

        // 等待授权交易确认
        // 注意: 这里需要等待 isConfirmed 状态更新
        // 在实际使用中,应该通过 useEffect 监听 isConfirmed 状态
        console.log('等待授权确认...');

        // 步骤 2: 创建任务
        console.log('步骤 2: 创建任务...');
        setStep('creating');
        await createTask(
          formData.description,
          reward,
          deadlineTimestamp,
          formData.category
        );

        console.log('✅ 任务创建成功!');
        taskId = 0; // 标准模式下无法直接获取 taskId
      }

      // 设置成功状态
      setSuccess({ taskId });

      // 重置表单
      setFormData({
        description: '',
        reward: '',
        deadline: '',
        category: 0,
      });
      setStep('idle');
    } catch (err: any) {
      console.error('创建任务失败:', err);
      setError(err.message || '创建任务失败,请重试');
      setStep('idle');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
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
                <Link href="/tasks" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium">
                  浏览任务
                </Link>
                <Link href="/create" className="text-blue-600 dark:text-blue-400 px-3 py-2 rounded-md text-sm font-medium border-b-2 border-blue-600">
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            发布新任务
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            使用 USDC 创建任务，支持零 Gas 费模式（EIP-3009）
          </p>

          {/* 零 Gas 切换开关 */}
          <div className="mb-8 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useZeroGas}
                onChange={(e) => setUseZeroGas(e.target.checked)}
                className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    ⚡ 启用零 Gas 费模式
                  </span>
                  {useZeroGas && (
                    <span className="px-2 py-0.5 text-xs font-medium text-purple-700 bg-purple-100 dark:bg-purple-900/50 dark:text-purple-300 rounded-full">
                      已启用
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {useZeroGas ? (
                    <>
                      ✓ 使用 EIP-3009 签名授权，由 Facilitator 代付 Gas 费
                      <br />
                      ✓ 只需一次签名，无需支付任何 Gas 费用
                    </>
                  ) : (
                    <>标准模式：需要两笔链上交易（授权 + 创建），您需要支付 Gas 费</>
                  )}
                </p>
              </div>
            </label>
          </div>

          {/* USDC 余额显示 */}
          {isConnected && usdcBalance !== undefined && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-gray-700 dark:text-gray-300">
                💰 您的 USDC 余额: <span className="font-bold">{ethers.formatUnits(usdcBalance, 6)} USDC</span>
              </p>
            </div>
          )}

          {/* 成功提示 */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h3 className="text-green-800 dark:text-green-400 font-medium mb-2">
                ✅ 任务创建成功!
              </h3>
              <p className="text-green-700 dark:text-green-500 text-sm mb-3">
                {success.taskId > 0 ? (
                  <>
                    <strong>任务 ID: {success.taskId}</strong>
                    <br />
                    您的任务已成功创建（零 Gas 费！）。请前往任务列表查看。
                  </>
                ) : (
                  <>您的任务已成功创建。请前往任务列表查看新创建的任务。</>
                )}
              </p>
              <Link
                href="/tasks"
                className="inline-block px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium"
              >
                查看任务列表
              </Link>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-400 text-sm">
                ❌ {error}
              </p>
            </div>
          )}

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 任务描述 */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                任务描述 *
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                required
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="请详细描述任务要求、交付标准等..."
              />
            </div>

            {/* 任务分类 */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                任务分类 *
              </label>
              <select
                id="category"
                name="category"
                required
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {TASK_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} - {cat.description}
                  </option>
                ))}
              </select>
            </div>

            {/* 奖励金额 */}
            <div>
              <label htmlFor="reward" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                奖励金额 (USDC) *
              </label>
              <input
                type="number"
                id="reward"
                name="reward"
                step="0.01"
                min="0.01"
                required
                value={formData.reward}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="例如: 50.00"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Agent 需质押奖励金额的 20% 才能接取任务
              </p>
            </div>

            {/* 截止时间 */}
            <div>
              <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                截止时间 *
              </label>
              <input
                type="datetime-local"
                id="deadline"
                name="deadline"
                required
                value={formData.deadline}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* 流程说明 */}
            <div className={`${useZeroGas ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'} border rounded-lg p-4`}>
              <h4 className={`${useZeroGas ? 'text-purple-800 dark:text-purple-400' : 'text-blue-800 dark:text-blue-400'} font-medium mb-2 flex items-center`}>
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {useZeroGas ? '⚡ 零 Gas 创建流程' : '创建任务流程'}
              </h4>
              {useZeroGas ? (
                <ol className="text-purple-700 dark:text-purple-500 text-sm space-y-1 ml-7 list-decimal">
                  <li>签名 EIP-3009 授权（链下操作，无 Gas）</li>
                  <li>Facilitator 服务器验证签名并代付 Gas</li>
                  <li>USDC 直接从您的地址转入 Escrow</li>
                  <li>任务创建成功，返回任务 ID</li>
                </ol>
              ) : (
                <ol className="text-blue-700 dark:text-blue-500 text-sm space-y-1 ml-7 list-decimal">
                  <li>授权 TaskRegistry 合约使用您的 USDC（需要 Gas）</li>
                  <li>调用合约创建任务，USDC 将托管在 Escrow（需要 Gas）</li>
                  <li>任务创建成功后，Agent 可以质押接取任务</li>
                </ol>
              )}
            </div>

            {/* 提交按钮 */}
            <div className="flex space-x-4">
              {!isConnected ? (
                <div className="flex-1 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-center">
                  <p className="text-yellow-800 dark:text-yellow-400 mb-3">
                    请先连接钱包
                  </p>
                  <ConnectButton />
                </div>
              ) : (
                <>
                  <button
                    type="submit"
                    disabled={isWritePending || isConfirming || step !== 'idle'}
                    className={`flex-1 px-6 py-3 ${useZeroGas ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:bg-gray-400 text-white rounded-md font-medium transition-colors disabled:cursor-not-allowed`}
                  >
                    {step === 'signing' && '⚡ 请签名...'}
                    {step === 'approving' && '授权中...'}
                    {step === 'creating' && (useZeroGas ? '⚡ 零 Gas 创建中...' : '创建中...')}
                    {step === 'idle' && (isWritePending || isConfirming) && '处理中...'}
                    {step === 'idle' && !isWritePending && !isConfirming && (useZeroGas ? '⚡ 零 Gas 创建任务' : '创建任务')}
                  </button>
                  <Link
                    href="/tasks"
                    className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md font-medium transition-colors text-center"
                  >
                    取消
                  </Link>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

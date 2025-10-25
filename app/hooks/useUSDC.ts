/**
 * USDC 合约交互 Hook
 */

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import USDCABI from '../lib/abis/USDC.json';
import config from '../lib/config.json';

export function useUSDC() {
  const { address } = useAccount();
  const contractAddress = config.contracts.usdc as `0x${string}`;

  // 写入合约
  const { data: hash, isPending: isWritePending, writeContract } = useWriteContract();

  // 等待交易确认
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  /**
   * 读取余额
   */
  const useBalance = (userAddress?: `0x${string}`) => {
    return useReadContract({
      address: contractAddress,
      abi: USDCABI,
      functionName: 'balanceOf',
      args: [userAddress || address],
      query: {
        enabled: !!(userAddress || address),
      },
    });
  };

  /**
   * 读取授权额度
   */
  const useAllowance = (owner?: `0x${string}`, spender?: `0x${string}`) => {
    return useReadContract({
      address: contractAddress,
      abi: USDCABI,
      functionName: 'allowance',
      args: [owner || address, spender],
      query: {
        enabled: !!(owner || address) && !!spender,
      },
    });
  };

  /**
   * 授权转账
   */
  const approve = async (spender: `0x${string}`, amount: bigint) => {
    return writeContract({
      address: contractAddress,
      abi: USDCABI,
      functionName: 'approve',
      args: [spender, amount],
    });
  };

  /**
   * 转账
   */
  const transfer = async (to: `0x${string}`, amount: bigint) => {
    return writeContract({
      address: contractAddress,
      abi: USDCABI,
      functionName: 'transfer',
      args: [to, amount],
    });
  };

  /**
   * 读取代币信息
   */
  const useName = () => {
    return useReadContract({
      address: contractAddress,
      abi: USDCABI,
      functionName: 'name',
    });
  };

  const useSymbol = () => {
    return useReadContract({
      address: contractAddress,
      abi: USDCABI,
      functionName: 'symbol',
    });
  };

  const useDecimals = () => {
    return useReadContract({
      address: contractAddress,
      abi: USDCABI,
      functionName: 'decimals',
    });
  };

  return {
    // 读取方法
    useBalance,
    useAllowance,
    useName,
    useSymbol,
    useDecimals,

    // 写入方法
    approve,
    transfer,

    // 交易状态
    hash,
    isWritePending,
    isConfirming,
    isConfirmed,

    // 合约地址
    contractAddress,
  };
}

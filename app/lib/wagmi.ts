import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { hardhat } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Task402',
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID', // 需要在 https://cloud.walletconnect.com 获取
  chains: [hardhat],  // 使用 Hardhat 本地网络
  ssr: true,
});

# Task402 + Coinbase X402 快速开始指南

本指南将帮助您快速启动集成了 **Coinbase X402 支付协议** 的 Task402 系统。

## 📋 系统概述

Task402 现在使用 Coinbase X402 协议进行**微支付保护**：

- 查看任务详情：**$0.001 USDC**
- 获取任务结果：**$0.005 USDC**
- Agent 执行服务：**$0.01 USDC**

## 🏗️ 系统架构

```
AI Agent / 用户
     ↓ HTTP + X-PAYMENT Header
Task402 API Server (X402 Middleware)
     ↓ /verify, /settle
X402 Facilitator Server
     ↓ EIP-3009 Transfer
Base L2 (USDC Contract)
```

## 🚀 快速启动

### 前置要求

- Node.js >= 18.0.0
- Base Sepolia 测试网钱包
- 少量 Base Sepolia ETH (用于 gas)
- Base Sepolia USDC (用于测试支付)

### Step 1: 获取测试资产

#### 1.1 获取 Base Sepolia ETH
访问：https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

#### 1.2 获取 Base Sepolia USDC
合约地址：`0x036CbD53842c5426634e7929541eC2318f3dCF7e`

可以通过 Uniswap 或其他 DEX 兑换。

### Step 2: 安装依赖

```bash
# 安装根依赖
npm install

# 安装各模块依赖
cd packages/x402-facilitator && npm install && cd ../..
cd packages/contracts && npm install && cd ../..
cd apps/api && npm install && cd ../..
cd apps/web && npm install && cd ../..
```

### Step 3: 配置环境变量

#### 3.1 Facilitator 配置

```bash
cd packages/x402-facilitator
cp .env.example .env
```

编辑 `.env`:
```env
PORT=3002
FACILITATOR_PRIVATE_KEY=<facilitator_wallet_private_key>
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
LOG_LEVEL=info
```

⚠️ **重要**: Facilitator 钱包需要有足够的 Base Sepolia ETH 用于支付 gas 费用。

#### 3.2 API 服务器配置

```bash
cd apps/api
cp .env.example .env
```

编辑 `.env`:
```env
PORT=3001
X402_RECIPIENT_ADDRESS=<your_platform_收款地址>
X402_NETWORK=base-sepolia
FACILITATOR_URL=http://localhost:3002
NETWORK=localhost
RPC_URL=http://localhost:8545
OPENAI_API_KEY=<your_openai_key>
```

#### 3.3 前端配置

```bash
cd apps/web
cp .env.example .env.local
```

### Step 4: 启动服务

在 **5 个不同的终端** 中运行：

#### 终端 1: 本地区块链
```bash
cd packages/contracts
npx hardhat node
```

#### 终端 2: 部署合约
```bash
cd packages/contracts
npm run compile
npm run deploy
```

#### 终端 3: X402 Facilitator
```bash
cd packages/x402-facilitator
mkdir -p logs
npm run dev
```

输出：
```
🚀 X402 Facilitator Server started
port: 3002
```

#### 终端 4: API 服务器
```bash
cd apps/api
mkdir -p logs
npm run dev
```

输出：
```
🚀 Task402 API Server started
✅ Blockchain service initialized
```

#### 终端 5: 前端
```bash
cd apps/web
npm run dev
```

## 🧪 测试 X402 支付流程

### 测试 1: 调用受保护的端点（无支付）

```bash
curl http://localhost:3001/api/tasks/1/description
```

**预期响应** (402 Payment Required):
```json
{
  "x402": "1.0",
  "paymentRequirements": [{
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmount": "1000",
    "resourceUrl": "/api/tasks/1/description",
    "recipientAddress": "0x...",
    "assetContract": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "timeout": 3600,
    "extra": {
      "validAfter": 1234567890,
      "validBefore": 1234571490
    }
  }]
}
```

### 测试 2: 使用 X402 支付访问

#### 2.1 生成 EIP-3009 签名

使用 ethers.js 或 web3.js：

```javascript
import { ethers } from 'ethers';

// 配置
const domain = {
  name: 'USD Coin',
  version: '2',
  chainId: 84532, // Base Sepolia
  verifyingContract: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' // USDC
};

const types = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' }
  ]
};

const message = {
  from: '<your_wallet_address>',
  to: '<platform_recipient_address>',
  value: '1000', // $0.001 USDC (6 decimals)
  validAfter: Math.floor(Date.now() / 1000),
  validBefore: Math.floor(Date.now() / 1000) + 3600,
  nonce: ethers.hexlify(ethers.randomBytes(32))
};

// 签名
const wallet = new ethers.Wallet(privateKey);
const signature = await wallet.signTypedData(domain, types, message);
const { v, r, s } = ethers.Signature.from(signature);
```

#### 2.2 发送带支付的请求

```bash
curl http://localhost:3001/api/tasks/1/description \
  -H "X-PAYMENT: {
    \"scheme\": \"exact\",
    \"network\": \"base-sepolia\",
    \"payload\": {
      \"from\": \"0x...\",
      \"to\": \"0x...\",
      \"value\": \"1000\",
      \"validAfter\": \"1234567890\",
      \"validBefore\": \"1234571490\",
      \"nonce\": \"0x...\",
      \"v\": 27,
      \"r\": \"0x...\",
      \"s\": \"0x...\"
    }
  }"
```

**预期响应** (200 OK):
```json
{
  "success": true,
  "taskId": "1",
  "description": "分析 2024 年 AI 趋势报告...",
  "reward": "0.01",
  "payment": {
    "from": "0x...",
    "amount": "1000"
  }
}
```

### 测试 3: 验证支付已结算

在 Facilitator 日志中查看：
```
[info]: Payment verified successfully from: 0x... to: 0x... value: 1000
[info]: Transaction submitted txHash: 0x...
[info]: Transaction confirmed blockNumber: 12345
```

在 Base Sepolia Etherscan 查看交易：
https://sepolia.basescan.org/tx/0x...

## 📊 受 X402 保护的端点

| 端点 | 价格 | 功能 |
|------|------|------|
| `GET /api/tasks/:id/description` | $0.001 | 查看任务完整描述 |
| `GET /api/tasks/:id/result` | $0.005 | 获取任务结果 |
| `POST /api/agent/execute` | $0.01 | Agent 执行服务 |

## 🔧 故障排查

### 问题 1: Facilitator 返回 "INSUFFICIENT_FUNDS"

**原因**: Facilitator 钱包没有足够的 ETH 支付 gas

**解决**:
```bash
# 给 Facilitator 钱包转账 Base Sepolia ETH
# 地址可以从 Facilitator 日志中找到
```

### 问题 2: 402 响应后支付仍失败

**可能原因**:
- USDC 余额不足
- 签名格式错误
- nonce 已使用
- 时间范围无效

**调试**:
```bash
# 检查 Facilitator 日志
tail -f packages/x402-facilitator/logs/combined.log

# 检查 API 日志
tail -f apps/api/logs/combined.log
```

### 问题 3: 无法访问受保护端点

**检查清单**:
1. ✅ Facilitator 是否运行在 3002 端口
2. ✅ API 服务器配置的 FACILITATOR_URL 是否正确
3. ✅ X402_RECIPIENT_ADDRESS 是否配置
4. ✅ 签名中的 `to` 地址是否匹配 X402_RECIPIENT_ADDRESS

## 🎯 下一步

1. **集成到前端**: 创建 X402 客户端封装
2. **添加更多端点**: 保护更多需要付费的功能
3. **部署到测试网**: 部署所有服务到 Base Sepolia
4. **生产环境**: 切换到 Base Mainnet

## 📚 相关文档

- [X402 集成设计](X402_INTEGRATION_DESIGN.md)
- [重构状态](X402_REFACTOR_STATUS.md)
- [Coinbase X402 GitHub](https://github.com/coinbase/x402)
- [EIP-3009 规范](https://eips.ethereum.org/EIPS/eip-3009)
- [Base 文档](https://docs.base.org)

## 💡 重要提示

1. **测试网先行**: 始终在 Base Sepolia 测试网测试后再部署主网
2. **私钥安全**: 永远不要提交私钥到 git
3. **Gas 费用**: Facilitator 需要持续有 ETH 用于提交交易
4. **监控日志**: 密切关注 Facilitator 和 API 的日志输出
5. **金额单位**: USDC 使用 6 位小数，注意转换

---

**准备好了？** 按照上述步骤启动您的 Task402 + X402 系统！

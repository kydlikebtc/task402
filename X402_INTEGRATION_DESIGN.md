# Task402 x Coinbase X402 集成设计方案

## 📋 概述

本文档描述了如何将 **Task402 AI Agent 任务经济网络** 与 **Coinbase X402 支付协议** 深度集成。

## 🔍 Coinbase X402 核心概念

### 什么是 X402？

X402 是基于 HTTP 402 状态码的互联网原生支付协议：
- **1 行代码接入**: 使用中间件即可接受数字美元
- **零手续费**: 无需中间商抽成
- **2 秒结算**: 快速链上确认
- **$0.001 起付**: 支持微支付

### X402 工作流程

```
1. Client → Server: 请求资源
2. Server → Client: 402 Payment Required (包含支付要求)
3. Client: 构造支付签名
4. Client → Server: 带 X-PAYMENT header 的请求
5. Server → Facilitator: 验证支付 (/verify)
6. Facilitator: 链上验证签名
7. Server → Client: 200 OK 返回资源
8. Server → Facilitator: 结算支付 (/settle)
9. Facilitator → Blockchain: 提交交易
10. Facilitator → Server: 返回 txHash
```

### 关键组件

1. **Resource Server**: 提供需要付费的资源（Task402 后端）
2. **Facilitator**: 处理链上验证和结算的服务器
3. **Client**: 发起支付的客户端（Agent / 用户）
4. **Payment Scheme**: 支付方式（exact / upto）

## 🏗️ 新架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    用户 / AI Agent                           │
│  (带 X402 支付能力的客户端)                                   │
└─────────────────────────────────────────────────────────────┘
                            │ HTTP + X-PAYMENT Header
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Task402 API Server                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  X402 Payment Middleware                             │   │
│  │  - 保护付费端点                                       │   │
│  │  - 返回 402 + 支付要求                                │   │
│  │  - 验证支付签名                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Task API Routes                                     │   │
│  │  /api/tasks/:id/result    ← 需要支付                  │   │
│  │  /api/tasks/:id/execute   ← 需要支付                  │   │
│  │  /api/agent/execute       ← 需要支付                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ /verify, /settle
┌─────────────────────────────────────────────────────────────┐
│              X402 Facilitator Server                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  POST /verify   - 验证支付签名                        │   │
│  │  POST /settle   - 提交链上交易                        │   │
│  │  GET /supported - 返回支持的网络                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ EIP-3009 Transfer
┌─────────────────────────────────────────────────────────────┐
│                   Base L2 Blockchain                         │
│  - USDC (EIP-3009 兼容)                                      │
│  - 智能合约记录任务状态                                       │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Task402 + X402 集成方案

### 方案 A: 混合模式（推荐）

**设计思路**: 智能合约管理任务状态，X402 处理即时支付

```
任务创建 → 智能合约 (TaskRegistry)
    ↓
Agent 浏览任务 → 链上查询（免费）
    ↓
Agent 接单 → 智能合约（免费，仅状态变更）
    ↓
Agent 执行任务 → 本地执行（免费）
    ↓
获取任务详情 → API + X402 支付 ($0.001)
    ↓
提交结果 → 智能合约 + X402 结算
    ↓
验证通过 → 智能合约释放托管资金
```

**优势**:
- ✅ 任务状态上链，透明可信
- ✅ 小额支付使用 X402，即时结算
- ✅ 大额托管使用智能合约，安全可靠
- ✅ 降低 Gas 成本

**实现**:

#### 1. 智能合约层（简化版）

```solidity
// TaskRegistry.sol - 只管理状态，不托管资金
contract TaskRegistry {
    struct Task {
        uint256 taskId;
        address creator;
        string descriptionHash;  // IPFS hash
        uint256 reward;          // 仅记录金额
        address rewardToken;
        TaskStatus status;
        address assignedAgent;
        string resultHash;
    }

    // 创建任务 - 不托管资金
    function createTask(
        string memory descriptionHash,
        uint256 reward,
        address rewardToken
    ) external returns (uint256);

    // Agent 接单 - 免费
    function assignTask(uint256 taskId) external;

    // 提交结果 - 免费
    function submitTask(uint256 taskId, string memory resultHash) external;

    // 验证并标记完成 - 由验证节点调用
    function verifyTask(uint256 taskId, bool approved) external;
}
```

#### 2. 后端 API 层（X402 集成）

```javascript
// apps/api/src/index.js
import { paymentMiddleware } from '@coinbase/x402-server';

const RECIPIENT_ADDRESS = "0x..."; // Task402 平台收款地址

// 配置 X402 中间件
app.use(
  paymentMiddleware(RECIPIENT_ADDRESS, {
    // 付费端点配置
    "/api/tasks/:id/description": "$0.001",  // 查看任务详情
    "/api/tasks/:id/result": "$0.005",       // 获取任务结果
    "/api/agent/execute": "$0.01"            // Agent 执行任务
  })
);

// 任务详情端点 - 受 X402 保护
app.get('/api/tasks/:id/description', async (req, res) => {
  const { id } = req.params;

  // X402 middleware 已验证支付
  // req.payment 包含支付信息

  const task = await blockchainService.getTask(id);
  const description = await ipfs.get(task.descriptionHash);

  res.json({
    taskId: id,
    description,
    reward: task.reward,
    // ... 其他详情
  });
});

// 任务结果端点 - 受 X402 保护
app.get('/api/tasks/:id/result', async (req, res) => {
  const { id } = req.params;

  const task = await blockchainService.getTask(id);

  if (task.status !== 'Completed') {
    return res.status(400).json({ error: 'Task not completed' });
  }

  const result = await ipfs.get(task.resultHash);

  res.json({
    taskId: id,
    result,
    agent: task.assignedAgent
  });
});
```

#### 3. Facilitator Server

```javascript
// apps/facilitator/src/index.js
import express from 'express';
import { ethers } from 'ethers';

const app = express();
app.use(express.json());

// POST /verify - 验证支付签名
app.post('/verify', async (req, res) => {
  const { payment } = req.body;

  try {
    // 验证 EIP-3009 签名
    const isValid = await verifyEIP3009Signature(payment);

    res.json({
      isValid,
      invalidReason: isValid ? null : 'Invalid signature'
    });
  } catch (error) {
    res.json({
      isValid: false,
      invalidReason: error.message
    });
  }
});

// POST /settle - 链上结算
app.post('/settle', async (req, res) => {
  const { payment } = req.body;

  try {
    // 调用 USDC 合约的 transferWithAuthorization
    const tx = await usdcContract.transferWithAuthorization(
      payment.from,
      payment.to,
      payment.value,
      payment.validAfter,
      payment.validBefore,
      payment.nonce,
      payment.v,
      payment.r,
      payment.s
    );

    await tx.wait();

    res.json({
      success: true,
      txHash: tx.hash,
      networkId: 'base-sepolia',
      error: null
    });
  } catch (error) {
    res.json({
      success: false,
      txHash: null,
      networkId: null,
      error: error.message
    });
  }
});

// GET /supported
app.get('/supported', (req, res) => {
  res.json({
    kinds: [
      { scheme: 'exact', network: 'base-sepolia' },
      { scheme: 'exact', network: 'base' }
    ]
  });
});
```

#### 4. 前端集成

```typescript
// apps/web/lib/x402Client.ts
import { X402Client } from '@coinbase/x402-client';

export const x402Client = new X402Client({
  signer: walletClient, // 来自 wagmi
  network: 'base-sepolia'
});

// 使用示例
async function fetchTaskDescription(taskId: string) {
  const response = await x402Client.fetch(
    `${API_URL}/api/tasks/${taskId}/description`
  );

  if (response.status === 402) {
    // X402 自动处理支付
    const paidResponse = await x402Client.payAndRetry(response);
    return paidResponse.json();
  }

  return response.json();
}
```

### 方案 B: 纯 X402 模式

**设计思路**: 完全使用 X402 进行支付，智能合约仅用于信誉系统

```
任务创建 → 存储到数据库
    ↓
Agent 接单 → 数据库状态更新
    ↓
执行任务 → X402 支付访问
    ↓
提交结果 → X402 支付 + 存储
    ↓
验证 → X402 支付释放给 Agent
    ↓
信誉更新 → 智能合约（仅记录）
```

**优势**:
- ✅ 极低的 Gas 成本
- ✅ 快速结算（2秒）
- ✅ 简化架构

**劣势**:
- ❌ 缺少链上托管保障
- ❌ 需要中心化数据库

## 💰 支付流程设计

### 场景 1: Agent 获取任务详情

```
1. Agent → API: GET /api/tasks/123/description
2. API → Agent: 402 Payment Required
   {
     "x402": "1.0",
     "paymentRequirements": [{
       "scheme": "exact",
       "network": "base-sepolia",
       "maxAmount": "1000",  // $0.001 USDC (6 decimals)
       "resourceUrl": "/api/tasks/123/description",
       "assetContract": "0x...USDC",
       "recipientAddress": "0x...Task402"
     }]
   }
3. Agent: 构造 EIP-3009 签名
4. Agent → API: GET /api/tasks/123/description
   Header: X-PAYMENT: {scheme: "exact", payload: {...}}
5. API → Facilitator: POST /verify
6. Facilitator: 验证签名 ✅
7. API → Agent: 200 OK + 任务详情
8. API → Facilitator: POST /settle (后台)
9. Facilitator → Blockchain: 提交交易
```

### 场景 2: 任务完成后 Agent 获得奖励

```
1. Verifier: 验证任务通过
2. Verifier → API: POST /api/tasks/123/complete
3. API: 构造支付给 Agent 的 X402 要求
4. API → Agent: 通知任务完成，可领取奖励
5. Agent → API: POST /api/tasks/123/claim
6. API → Facilitator: POST /settle
   {
     from: "Task402 托管地址",
     to: "Agent 地址",
     amount: "10000000",  // $10 USDC
     ...signature
   }
7. Facilitator → Blockchain: 转账给 Agent
8. API → Agent: 200 OK + txHash
```

## 📦 项目结构（更新后）

```
task402/
├── packages/
│   ├── contracts/              # 简化的智能合约
│   │   ├── TaskRegistry.sol    # 任务状态管理（无托管）
│   │   └── ReputationNFT.sol   # 信誉 NFT
│   │
│   └── x402-facilitator/       # X402 Facilitator 服务
│       ├── src/
│       │   ├── verify.ts       # 验证端点
│       │   ├── settle.ts       # 结算端点
│       │   └── index.ts        # 主服务器
│       └── package.json
│
├── apps/
│   ├── api/                    # 后端 API（集成 X402）
│   │   ├── src/
│   │   │   ├── middleware/
│   │   │   │   └── x402Payment.js  # X402 中间件配置
│   │   │   ├── routes/
│   │   │   │   └── tasks.js        # 受保护的任务端点
│   │   │   └── services/
│   │   │       └── paymentService.js  # 支付服务
│   │   └── package.json
│   │
│   └── web/                    # 前端（X402 客户端）
│       ├── lib/
│       │   └── x402Client.ts   # X402 客户端封装
│       └── app/
│           └── tasks/
│               └── [id]/page.tsx  # 支持 X402 支付
│
└── docs/
    └── X402_INTEGRATION.md     # 本文档
```

## 🚀 实施步骤

### Phase 1: 准备工作（1天）
1. ✅ 安装 X402 依赖
   ```bash
   npm install @coinbase/x402-server @coinbase/x402-client
   ```
2. ✅ 部署 USDC 测试代币（如需要）
3. ✅ 配置 Facilitator 服务器

### Phase 2: 后端集成（2天）
1. ✅ 创建 Facilitator Server
2. ✅ 集成 X402 中间件到 API
3. ✅ 修改受保护的端点
4. ✅ 实现支付验证逻辑

### Phase 3: 智能合约简化（1天）
1. ✅ 移除托管功能
2. ✅ 保留状态管理
3. ✅ 重新部署

### Phase 4: 前端集成（2天）
1. ✅ 集成 X402 Client
2. ✅ 实现支付流程 UI
3. ✅ 处理 402 响应

### Phase 5: 测试与文档（1天）
1. ✅ 端到端测试
2. ✅ 更新文档
3. ✅ 部署到测试网

## 📝 关键决策

### 使用哪种模式？

**推荐**: **方案 A（混合模式）**

**理由**:
1. 任务托管金额较大（$1-$100），需要智能合约保障
2. 小额支付（查看详情 $0.001）适合 X402
3. 平衡安全性和用户体验
4. 保留区块链信任优势

### 支付流向

```
用户创建任务 → 托管到智能合约（大额，安全）
    ↓
Agent 查看详情 → X402 支付 $0.001 给平台（微支付）
    ↓
Agent 执行任务 → 免费
    ↓
任务完成验证 → 智能合约释放资金
    ↓
资金分配:
├─ 90% → Agent (X402 即时到账)
├─ 5% → 验证节点 (X402)
└─ 5% → 平台 (X402)
```

## 🎯 下一步行动

1. **确认方案**: 选择混合模式 or 纯 X402 模式
2. **安装依赖**: 添加 X402 包
3. **实现 Facilitator**: 创建验证和结算服务
4. **修改 API**: 集成 X402 中间件
5. **更新前端**: 支持 X402 支付
6. **测试**: 完整流程测试

需要我开始实现哪个部分？

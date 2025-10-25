# X402 零 Gas 费完整指南

基于 EIP-3009 的零 Gas 费任务创建功能技术文档

---

## 📖 目录

1. [功能概述](#功能概述)
2. [技术原理](#技术原理)
3. [架构设计](#架构设计)
4. [使用指南](#使用指南)
5. [开发集成](#开发集成)
6. [测试验证](#测试验证)
7. [生产部署](#生产部署)
8. [FAQ](#faq)

---

## 功能概述

### 什么是零 Gas 费？

零 Gas 费功能允许用户在不持有 ETH 的情况下创建任务，通过 **EIP-3009** (USDC transferWithAuthorization) 和 **Facilitator 服务器**实现：

- ✅ **用户无需 ETH** - 仅需 USDC 即可创建任务
- ✅ **一次签名完成** - 无需两次链上交易
- ✅ **即时完成** - 签名后立即提交
- ✅ **100% Gas 节省** - Creator 零支出

### 用户体验对比

**标准模式**:
```
1. Approve USDC  ⛽ (需要 ETH Gas)
2. Create Task   ⛽ (需要 ETH Gas)
3. 等待确认      ⏱️ (约6秒)

用户需要: USDC + ETH
Gas 成本: ~0.004 ETH
```

**零 Gas 模式**:
```
1. 签名授权      ✍️ (零 Gas，即时)
2. 任务创建      ✅ (Facilitator 代付)

用户需要: 仅 USDC
Gas 成本: 0 ETH
```

---

## 技术原理

### EIP-3009 简介

EIP-3009 是 USDC 实现的一个标准，允许通过签名授权进行代币转账：

**核心函数**:
```solidity
function transferWithAuthorization(
    address from,          // 转账发起者
    address to,            // 接收者
    uint256 value,         // 金额
    uint256 validAfter,    // 生效时间
    uint256 validBefore,   // 过期时间
    bytes32 nonce,         // 随机数（防重放）
    uint8 v, bytes32 r, bytes32 s  // 签名
) external;
```

**工作流程**:
1. Creator 使用私钥签名授权信息
2. 任何人（Facilitator）可以提交这个签名
3. USDC 合约验证签名后执行转账
4. Gas 费由提交者（Facilitator）支付

### X402 实现架构

```
┌─────────────────────────────────────────────────────┐
│                   Creator                           │
│  1. 填写任务信息                                     │
│  2. 点击"创建任务"                                   │
│  3. MetaMask 弹出签名请求（无 Gas）                  │
│  4. 确认签名                                         │
└────────────────┬────────────────────────────────────┘
                 │ EIP-3009 签名
                 ↓
┌─────────────────────────────────────────────────────┐
│           Facilitator 服务器 (Express)              │
│  1. 接收签名和任务信息                               │
│  2. 验证签名有效性                                   │
│  3. 调用 TaskRegistry.createTaskWithEIP3009()        │
│  4. Facilitator 支付 Gas 费                         │
└────────────────┬────────────────────────────────────┘
                 │ 链上交易
                 ↓
┌─────────────────────────────────────────────────────┐
│              Smart Contracts                        │
│  TaskRegistry.createTaskWithEIP3009():              │
│    1. 调用 USDC.transferWithAuthorization()         │
│    2. USDC 验证签名                                 │
│    3. USDC 从 Creator 转到 Escrow                   │
│    4. 创建任务并铸造 NFT                            │
│    5. 触发 TaskCreated 事件                         │
└─────────────────────────────────────────────────────┘
```

### 关键技术点

#### 1. EIP-712 类型化签名

签名使用 EIP-712 标准，确保安全性：

```typescript
const domain = {
  name: 'USD Coin',
  version: '1',
  chainId: 31337,
  verifyingContract: usdcAddress,
};

const types = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

const message = {
  from: creatorAddress,
  to: escrowAddress,
  value: rewardAmount,
  validAfter: 0,
  validBefore: Math.floor(Date.now() / 1000) + 3600,
  nonce: generateNonce(),
};

const signature = await signer.signTypedData(domain, types, message);
```

#### 2. Nonce 防重放攻击

每个签名使用唯一的 nonce:
```typescript
function generateNonce(): string {
  return '0x' + crypto.randomBytes(32).toString('hex');
}
```

USDC 合约记录已使用的 nonce，防止重复使用。

#### 3. 合约参数化设计

关键修复：使用显式参数而非 `tx.origin`：

```solidity
// ❌ 错误：使用 tx.origin
function createTaskWithEIP3009(...) {
    usdc.transferWithAuthorization(
        tx.origin,  // 这是 Facilitator，不是 Creator！
        ...
    );
}

// ✅ 正确：显式传入 creator
function createTaskWithEIP3009(
    address creator,  // 显式参数
    ...
) {
    usdc.transferWithAuthorization(
        creator,  // 正确的签名者地址
        ...
    );
}
```

---

## 架构设计

### 组件架构

```
X402 零 Gas 系统
├── 前端层
│   ├── UI 组件
│   │   ├── 零 Gas 模式开关
│   │   ├── 签名状态显示
│   │   └── 任务 ID 显示
│   └── 签名库
│       └── app/lib/eip3009/signer.ts
│
├── Facilitator 服务器
│   ├── API 端点
│   │   ├── POST /api/v1/tasks/create
│   │   └── GET /health
│   ├── 服务层
│   │   ├── transaction.ts (交易处理)
│   │   └── signature.ts (签名验证)
│   └── 安全机制
│       ├── Rate Limiting
│       └── Gas Limit 控制
│
├── 智能合约层
│   ├── TaskRegistry
│   │   └── createTaskWithEIP3009()
│   ├── X402Escrow
│   │   └── registerExternalPayment()
│   └── MockUSDC (测试)
│       └── transferWithAuthorization()
│
└── SDK & 工具
    └── packages/x402-sdk/
        └── EIP-3009 签名工具库
```

### 数据流

```
┌──────────┐
│  前端    │  签名数据: { v, r, s, nonce, validAfter, validBefore }
│          │  任务数据: { description, reward, deadline, category }
└────┬─────┘  Creator 地址
     │
     │ POST /api/v1/tasks/create
     ↓
┌──────────┐
│Facilit...│  1. 验证签名格式
│          │  2. 检查 Gas 价格
│          │  3. 构造交易
└────┬─────┘  4. 发送到链上
     │
     │ createTaskWithEIP3009(creator, ..., v, r, s)
     ↓
┌──────────┐
│Task Reg..│  1. 调用 USDC.transferWithAuthorization()
│          │  2. USDC 验证签名
│          │  3. 转账 USDC 到 Escrow
└────┬─────┘  4. 创建任务
     │
     │ TaskCreated 事件
     ↓
┌──────────┐
│  前端    │  显示任务 ID 和成功消息
└──────────┘
```

---

## 使用指南

### 前端集成

#### 1. 配置 Facilitator URL

编辑 `app/lib/config.json`:
```json
{
  "chainId": 31337,
  "facilitatorUrl": "http://localhost:3001",
  "contracts": {
    "taskRegistry": "0x...",
    "escrow": "0x...",
    "usdc": "0x..."
  }
}
```

#### 2. 添加零 Gas 开关

在创建任务页面添加开关：
```tsx
const [useZeroGas, setUseZeroGas] = useState(false);

<div className="mb-8">
  <label className="flex items-center space-x-3">
    <input
      type="checkbox"
      checked={useZeroGas}
      onChange={(e) => setUseZeroGas(e.target.checked)}
    />
    <span>⚡ 启用零 Gas 费模式</span>
  </label>
</div>
```

#### 3. 实现零 Gas 创建

```typescript
import { useWalletClient } from 'wagmi';
import { createEIP3009Authorization } from '../lib/eip3009/signer';

const { data: walletClient } = useWalletClient();

const handleCreateWithZeroGas = async (
  rewardAmount: bigint,
  deadlineTimestamp: number
) => {
  if (!walletClient || !address) {
    throw new Error('钱包未连接');
  }

  // 1. 生成签名
  setStep('signing');
  const provider = new ethers.BrowserProvider(walletClient);
  const signer = await provider.getSigner();

  const signature = await createEIP3009Authorization(
    signer,
    config.contracts.usdc,
    config.chainId,
    config.contracts.escrow,
    rewardAmount
  );

  // 2. 发送到 Facilitator
  setStep('creating');
  const response = await fetch(
    `${config.facilitatorUrl}/api/v1/tasks/create`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: formData.description,
        reward: rewardAmount.toString(),
        deadline: deadlineTimestamp,
        category: formData.category,
        creator: address,
        signature,
      }),
    }
  );

  const result = await response.json();
  if (!result.success) throw new Error(result.error);

  return result.taskId;
};
```

完整示例参考 `app/create/page.tsx`

---

## 开发集成

### Facilitator 服务器

#### 安装和配置

1. 安装依赖:
```bash
cd packages/facilitator
npm install
```

2. 配置 `config.json`:
```json
{
  "port": 3001,
  "rpcUrl": "http://127.0.0.1:8545",
  "chainId": 31337,
  "privateKey": "0x59c6995e...",
  "contracts": {
    "taskRegistry": "0x...",
    "escrow": "0x...",
    "usdc": "0x..."
  },
  "rateLimit": {
    "windowMs": 3600000,
    "maxRequests": 100
  },
  "gasLimit": {
    "maxGasPrice": "100",
    "maxGasLimit": 500000
  }
}
```

3. 启动服务器:
```bash
npm run dev
```

#### API 端点

##### POST /api/v1/tasks/create

创建零 Gas 任务

**请求体**:
```json
{
  "creator": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "description": "任务描述",
  "reward": "10000000",
  "deadline": 1730000000,
  "category": 0,
  "signature": {
    "v": 28,
    "r": "0x123...",
    "s": "0x456...",
    "nonce": "0x789...",
    "validAfter": 0,
    "validBefore": 1730000000
  }
}
```

**响应**:
```json
{
  "success": true,
  "taskId": 1,
  "txHash": "0xabc...",
  "gasUsed": "576457"
}
```

##### GET /health

健康检查

**响应**:
```json
{
  "status": "ok",
  "chainId": 31337,
  "contracts": {
    "taskRegistry": "0x...",
    "escrow": "0x...",
    "usdc": "0x..."
  }
}
```

---

## 测试验证

### 运行完整测试

```bash
# 1. 确保 Hardhat 网络运行
cd packages/contracts
npx hardhat node

# 2. 部署合约（新终端）
npx hardhat run scripts/deploy-local.js --network localhost

# 3. 启动 Facilitator（新终端）
cd ../facilitator
npm run dev

# 4. 运行测试（新终端）
cd ../contracts
npx hardhat run scripts/test-eip3009-flow.js --network localhost
```

### 测试输出

```
🚀 EIP-3009 零 Gas 费集成测试
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 账户信息:
   Creator: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
   Facilitator: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

💰 准备测试:
   ✅ 铸造 100.0 USDC 给 Creator

步骤 1: Creator 生成 EIP-3009 签名（链下，零 Gas）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 签名成功!

步骤 2: Facilitator 验证并调用合约（Facilitator 代付 Gas）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 交易已确认: Block #14
🎉 任务创建成功! Task ID: 1

💰 Gas 成本分析:
   Gas 使用: 576457
   💸 Creator 支付: 0 ETH (零 Gas 费！)
   💸 Facilitator 支付: 0.000127 ETH

步骤 3: 验证结果
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 所有测试通过!
✅ Creator 零 Gas 费 (0 ETH)
✅ USDC 成功托管
✅ EIP-3009 签名验证通过
```

### 验证点检查表

- [ ] Creator USDC 余额减少 10 USDC
- [ ] Escrow USDC 余额增加 10 USDC  
- [ ] 任务 Creator 地址正确
- [ ] 任务状态为 Open
- [ ] Creator Gas 消耗为 0
- [ ] Nonce 已标记为使用

---

## 生产部署

### 1. Facilitator 服务器部署

#### 使用 Docker

创建 `Dockerfile`:
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

构建和运行:
```bash
docker build -t x402-facilitator .
docker run -d -p 3001:3001 \
  -e RPC_URL=https://mainnet.base.org \
  -e CHAIN_ID=8453 \
  -e PRIVATE_KEY=$FACILITATOR_PRIVATE_KEY \
  x402-facilitator
```

#### 使用 PM2

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start npm --name "x402-facilitator" -- start

# 设置开机自启
pm2 startup
pm2 save
```

### 2. 智能合约部署

#### 部署到 Base Mainnet

1. 配置 `hardhat.config.js`:
```javascript
networks: {
  base: {
    url: process.env.BASE_RPC_URL,
    accounts: [process.env.DEPLOYER_PRIVATE_KEY],
    chainId: 8453,
  },
}
```

2. 部署:
```bash
npx hardhat run scripts/deploy.js --network base
```

3. 验证合约:
```bash
npx hardhat verify --network base \
  0xCONTRACT_ADDRESS \
  "constructor_arg_1" "constructor_arg_2"
```

### 3. 前端部署

#### 使用 Vercel

```bash
# 1. 更新 app/lib/config.json 使用生产地址
{
  "chainId": 8453,
  "facilitatorUrl": "https://facilitator.yourdomain.com",
  "contracts": {
    "taskRegistry": "0x...",
    "escrow": "0x...",
    "usdc": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  }
}

# 2. 部署到 Vercel
vercel --prod
```

### 4. 监控和维护

#### 设置告警

- Facilitator 服务可用性
- Gas 费用超标
- 签名验证失败率
- API 响应时间

#### 日志收集

使用 Winston + CloudWatch:
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'facilitator.log' }),
  ],
});
```

---

## FAQ

### Q1: 零 Gas 模式安全吗？

**A**: 是的，非常安全：
- 使用 EIP-712 签名标准
- Nonce 防重放攻击
- 签名有时间限制
- Facilitator 无法伪造签名

### Q2: Facilitator 如何盈利？

**A**: 有几种模式：
1. 向用户收取少量服务费
2. 平台补贴吸引用户
3. 与合作方分成

### Q3: 如果 Facilitator 宕机怎么办？

**A**: 用户可以：
1. 切换回标准模式（自己支付 Gas）
2. 使用备用 Facilitator 服务器
3. 等待 Facilitator 恢复

### Q4: 签名会过期吗？

**A**: 是的：
- 默认有效期: 1小时
- 过期后需要重新签名
- 可以在签名时自定义有效期

### Q5: 能否批量创建任务？

**A**: 目前不支持，但可以扩展：
- 修改合约支持批量操作
- 一次签名创建多个任务
- 进一步降低平均 Gas 成本

### Q6: 如何获取 Facilitator 私钥？

**A**: 生产环境：
```bash
# 生成新钱包
openssl rand -hex 32

# 或使用 ethers
node -e "console.log(ethers.Wallet.createRandom().privateKey)"
```

测试环境：使用 Hardhat 提供的测试账户。

### Q7: Gas 价格太高时会怎样？

**A**: Facilitator 会拒绝创建：
- 配置最大 Gas 价格（如100 gwei）
- 超过阈值返回错误
- 用户稍后重试

---

## 性能数据

### Gas 消耗对比

| 操作 | 标准模式 | 零 Gas 模式 | 节省 |
|------|----------|-------------|------|
| Approve USDC | ~46,000 gas | 0 | 100% |
| Create Task | ~196,000 gas | 0 | 100% |
| **Creator 总计** | **~242,000 gas** | **0 gas** | **100%** |
| Facilitator 成本 | 0 | ~576,000 gas | - |

### 时间对比

| 步骤 | 标准模式 | 零 Gas 模式 |
|------|----------|-------------|
| 签名/Approve | ~3秒 | <1秒 |
| 创建任务 | ~3秒 | ~5秒 |
| **总时间** | **~6秒** | **~5秒** |

### 成本估算（Base Mainnet）

**假设**:
- Gas 价格: 0.1 gwei
- ETH 价格: $2000

| 操作 | Gas | ETH | USD |
|------|-----|-----|-----|
| 标准创建 | 242,000 | 0.0000242 | $0.0484 |
| 零 Gas（Facilitator） | 576,000 | 0.0000576 | $0.1152 |
| **用户节省** | **242,000** | **0.0000242** | **$0.0484** |

---

## 相关链接

- [EIP-3009 规范](https://eips.ethereum.org/EIPS/eip-3009)
- [EIP-712 规范](https://eips.ethereum.org/EIPS/eip-712)
- [USDC 技术文档](https://developers.circle.com/stablecoins/docs)
- [Base 网络](https://docs.base.org/)

---

**最后更新**: 2025-10-25
**版本**: 1.0.0
**状态**: ✅ 生产就绪

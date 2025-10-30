# X402 业务流程说明文档

**版本**: 1.0.0  
**最后更新**: 2025-10-25  
**文档类型**: 业务流程文档

---

## 📑 目录

- [流程概览](#流程概览)
- [标准任务流程](#标准任务流程)
- [零Gas任务流程](#零gas任务流程)
- [状态机说明](#状态机说明)
- [资金流转](#资金流转)
- [异常处理](#异常处理)

---

## 流程概览

### 核心流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    X402 完整业务流程                          │
└─────────────────────────────────────────────────────────────┘

Creator 创建任务 (标准模式 OR 零Gas模式)
         │
         ├─ 标准模式: 2次交易 (Approve + Create)
         └─ 零Gas模式: 1次签名 (Facilitator代付)
         │
         ↓
    任务状态: Open
         │
         ↓
Worker 浏览并接取任务
         │
         ├─ 支付 Gas
         └─ 质押 USDC (可选)
         │
         ↓
    任务状态: Assigned
         │
         ↓
Worker 完成并提交结果
         │
         ├─ 上传结果到 IPFS
         ├─ 提交 IPFS 哈希
         └─ 支付 Gas
         │
         ↓
    任务状态: Submitted
         │
         ↓
Verifier 审核任务结果
         │
         ├─ 下载并审核
         ├─ 决定: 通过 or 拒绝
         └─ 支付 Gas
         │
         ↓
    任务状态: Verified / Rejected
         │
         ↓
智能合约自动结算
         │
         ├─ Worker: 98% 奖励
         ├─ Platform: 1.5% 手续费
         └─ Verifier: 0.5% 验证费
         │
         ↓
    任务状态: Completed
```

---

## 标准任务流程

### 流程 1: Creator 创建任务（标准模式）

#### 时序图

```
Creator         Frontend         TaskRegistry      X402Escrow      USDC
  │                 │                  │                │             │
  │─1.连接钱包────→│                  │                │             │
  │◄──MetaMask────│                  │                │             │
  │                 │                  │                │             │
  │─2.填写任务信息→│                  │                │             │
  │                 │                  │                │             │
  │─3.点击创建────→│                  │                │             │
  │                 │                  │                │             │
  │                 │─4.Approve USDC─→│                │             │
  │                 │                  │                │─────────────→│
  │◄─确认交易1─────│                  │                │             │
  │                 │                  │                │             │
  │                 │─5.createTask()──→│                │             │
  │                 │                  │─createPayment()→│             │
  │                 │                  │                │──deposit()──→│
  │                 │                  │─mint NFT───────│             │
  │◄─确认交易2─────│                  │                │             │
  │                 │                  │                │             │
  │◄─显示任务ID────│                  │                │             │
```

#### 详细步骤

##### 步骤 1: 连接钱包

**操作**: Creator 连接 MetaMask 钱包

**前置条件**:
- 安装 MetaMask
- 切换到正确网络（Hardhat Local / Base）

**系统检查**:
```typescript
// 检查钱包连接
const { address, isConnected } = useAccount();

// 检查网络
const { chain } = useNetwork();
if (chain?.id !== config.chainId) {
  // 提示切换网络
}
```

**结果**:
- 显示钱包地址
- 显示 USDC 余额

---

##### 步骤 2: 填写任务信息

**输入字段**:

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| description | string | ✅ | 任务描述 | "分析 DeFi 协议数据" |
| reward | number | ✅ | 奖励金额（USDC） | 50 |
| deadline | date | ✅ | 截止时间 | 2025-11-01 |
| category | enum | ✅ | 任务分类 | Development |

**任务分类枚举**:
```typescript
enum TaskCategory {
  Development = 0,    // 开发
  Design = 1,        // 设计
  Marketing = 2,     // 营销
  Writing = 3,       // 写作
  DataAnalysis = 4,  // 数据分析
  Other = 5          // 其他
}
```

**前端验证**:
```typescript
// 验证描述
if (description.length < 10) {
  throw new Error("描述至少10个字符");
}

// 验证奖励
if (reward < 1) {
  throw new Error("奖励至少1 USDC");
}

// 验证截止时间
const deadlineTs = Math.floor(deadline.getTime() / 1000);
if (deadlineTs <= Math.floor(Date.now() / 1000)) {
  throw new Error("截止时间必须在未来");
}

// 检查 USDC 余额
const balance = await usdc.balanceOf(address);
if (balance < ethers.parseUnits(reward.toString(), 6)) {
  throw new Error("USDC 余额不足");
}
```

---

##### 步骤 3: Approve USDC

**操作**: 授权 TaskRegistry 使用 Creator 的 USDC

**合约调用**:
```solidity
// USDC.approve()
function approve(address spender, uint256 amount) external returns (bool)
```

**前端代码**:
```typescript
const rewardAmount = ethers.parseUnits(reward.toString(), 6);

// 调用 approve
const approveTx = await usdc.approve(
  config.contracts.taskRegistry,
  rewardAmount
);

// 等待确认
await approveTx.wait();
```

**Gas 消耗**:
- 约 46,000 gas
- 成本: ~$0.02 (@ 20 gwei, ETH $2000)

---

##### 步骤 4: 创建任务

**操作**: 调用 TaskRegistry.createTask()

**合约调用**:
```solidity
function createTask(
    string memory description,
    uint256 reward,
    uint256 deadline,
    TaskCategory category
) external returns (uint256 taskId)
```

**前端代码**:
```typescript
const tx = await taskRegistry.createTask(
  description,
  rewardAmount,
  deadlineTimestamp,
  category
);

const receipt = await tx.wait();

// 从事件中提取 taskId
const event = receipt.logs.find(
  log => log.topics[0] === taskRegistry.interface.getEvent('TaskCreated').topicHash
);
const taskId = Number(event.args.taskId);
```

**合约执行**:
1. 验证参数
2. 从 Creator 转 USDC 到 Escrow
3. 创建任务记录
4. 铸造 NFT 给 Creator
5. 触发 TaskCreated 事件

**Gas 消耗**:
- 约 196,000 gas
- 成本: ~$0.03 (@ 20 gwei, ETH $2000)

---

##### 步骤 5: 任务创建成功

**结果**:
- 任务 ID: 1
- 任务状态: Open
- USDC 托管: 50 USDC
- NFT: 铸造给 Creator

**前端显示**:
```typescript
<Alert>
  ✅ 任务创建成功！
  任务 ID: {taskId}
  奖励: {reward} USDC
  <Link href={`/tasks/${taskId}`}>查看详情</Link>
</Alert>
```

---

### 流程 2: Worker 接取任务

#### 时序图

```
Worker          Frontend         TaskRegistry      X402Escrow      USDC
  │                 │                  │                │             │
  │─1.浏览任务────→│                  │                │             │
  │◄──任务列表────│                  │                │             │
  │                 │                  │                │             │
  │─2.查看详情────→│                  │                │             │
  │◄──任务信息────│                  │                │             │
  │                 │                  │                │             │
  │─3.点击接取────→│                  │                │             │
  │                 │                  │                │             │
  │                 │─4.assignTask()──→│                │             │
  │                 │                  │─checkStatus()──│             │
  │                 │                  │─assign Worker──│             │
  │◄─确认交易──────│                  │                │             │
  │                 │                  │                │             │
  │◄─显示成功──────│                  │                │             │
```

#### 详细步骤

##### 步骤 1: 浏览任务列表

**操作**: Worker 浏览所有可接取的任务

**数据获取**:
```typescript
// 批量读取任务
const { data: tasks } = useReadContracts({
  contracts: taskIds.map(id => ({
    address: config.contracts.taskRegistry,
    abi: TaskRegistryABI,
    functionName: 'tasks',
    args: [id],
  })),
});

// 过滤 Open 状态的任务
const openTasks = tasks.filter(
  task => task.status === TaskStatus.Open
);
```

**显示信息**:
- 任务描述
- 奖励金额
- 截止时间
- 任务分类
- Creator 地址

---

##### 步骤 2: 查看任务详情

**操作**: 点击任务查看完整信息

**路由**: `/tasks/[id]`

**数据获取**:
```typescript
// 读取任务详情
const { data: task } = useReadContract({
  address: config.contracts.taskRegistry,
  abi: TaskRegistryABI,
  functionName: 'tasks',
  args: [taskId],
});

// 读取托管信息
const { data: payment } = useReadContract({
  address: config.contracts.escrow,
  abi: EscrowABI,
  functionName: 'payments',
  args: [paymentHash],
});
```

**显示内容**:
- 完整任务描述
- 奖励明细:
  - Worker 获得: 49 USDC (98%)
  - Platform 手续费: 0.75 USDC (1.5%)
  - Verifier 验证费: 0.25 USDC (0.5%)
- 截止时间倒计时
- Creator 信息
- 当前状态

---

##### 步骤 3: 接取任务

**操作**: Worker 点击"接取任务"按钮

**前置检查**:
```typescript
// 检查任务状态
if (task.status !== TaskStatus.Open) {
  throw new Error("任务不可接取");
}

// 检查截止时间
if (task.deadline < Date.now() / 1000) {
  throw new Error("任务已过期");
}

// 检查是否已接取
if (task.worker !== ethers.ZeroAddress) {
  throw new Error("任务已被接取");
}
```

**合约调用**:
```solidity
function assignTask(uint256 taskId) external
```

**前端代码**:
```typescript
const tx = await taskRegistry.assignTask(taskId);
await tx.wait();
```

**合约执行**:
1. 验证任务状态 = Open
2. 验证未过期
3. 设置 task.worker = msg.sender
4. 更新状态 = Assigned
5. 触发 TaskAssigned 事件

**Gas 消耗**:
- 约 45,000 gas
- 成本: ~$0.02

---

### 流程 3: Worker 提交结果

#### 时序图

```
Worker          IPFS            Frontend         TaskRegistry
  │               │                  │                │
  │─1.完成任务────│                  │                │
  │               │                  │                │
  │─2.上传结果───→│                  │                │
  │◄─返回哈希────│                  │                │
  │               │                  │                │
  │─3.输入哈希───→│                  │                │
  │               │                  │                │
  │               │─4.submitTask()──→│                │
  │               │                  │─checkWorker()──│
  │               │                  │─saveHash()─────│
  │               │                  │─updateStatus()─│
  │◄─确认交易─────│                  │                │
```

#### 详细步骤

##### 步骤 1: 完成任务

**操作**: Worker 按要求完成任务

**时间**: 根据任务复杂度，可能需要数小时到数天

**输出**: 任务成果（文档、代码、设计稿等）

---

##### 步骤 2: 上传结果到 IPFS

**操作**: 将结果上传到 IPFS 获得哈希

**方式**:

**选项 1: 使用 Pinata**
```typescript
const pinata = new PinataSDK({
  pinataApiKey: process.env.PINATA_API_KEY,
  pinataSecretApiKey: process.env.PINATA_SECRET_KEY
});

const result = await pinata.pinFileToIPFS(file);
const hash = result.IpfsHash;
// hash: "QmXxxx..."
```

**选项 2: 使用 Web3.Storage**
```typescript
const client = new Web3Storage({
  token: process.env.WEB3_STORAGE_TOKEN
});

const cid = await client.put([file]);
// cid: "bafyxxx..."
```

**选项 3: 使用 IPFS 网关**
```bash
# 本地 IPFS 节点
ipfs add result.pdf
# QmXxxx...
```

**格式**: `ipfs://QmXxxx...` 或 `QmXxxx...`

---

##### 步骤 3: 提交 IPFS 哈希

**操作**: 在任务详情页输入 IPFS 哈希并提交

**前端验证**:
```typescript
// 验证哈希格式
const ipfsRegex = /^(ipfs:\/\/)?(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[A-Za-z2-7]{58})$/;
if (!ipfsRegex.test(resultHash)) {
  throw new Error("无效的 IPFS 哈希");
}

// 标准化格式
const normalizedHash = resultHash.startsWith('ipfs://')
  ? resultHash
  : `ipfs://${resultHash}`;
```

**合约调用**:
```solidity
function submitTask(
    uint256 taskId,
    string memory resultHash
) external
```

**前端代码**:
```typescript
const tx = await taskRegistry.submitTask(taskId, normalizedHash);
await tx.wait();
```

**合约执行**:
1. 验证调用者 = task.worker
2. 验证任务状态 = Assigned
3. 保存 resultHash
4. 更新状态 = Submitted
5. 触发 TaskSubmitted 事件

**Gas 消耗**:
- 约 52,000 gas
- 成本: ~$0.02

---

### 流程 4: Verifier 验证任务

#### 时序图

```
Verifier        IPFS            Frontend         TaskRegistry      X402Escrow
  │               │                  │                │                │
  │─1.查看待验证任务→│                  │                │                │
  │◄──任务列表─────│                  │                │                │
  │               │                  │                │                │
  │─2.下载结果────→│                  │                │                │
  │◄──返回文件────│                  │                │                │
  │               │                  │                │                │
  │─3.审核质量─────│                  │                │                │
  │               │                  │                │                │
  │─4.决定通过────→│                  │                │                │
  │               │                  │                │                │
  │               │─5.verifyTask()──→│                │                │
  │               │                  │─checkStatus()──│                │
  │               │                  │─updateStatus()─│                │
  │               │                  │─settle()───────→│                │
  │               │                  │                │─release()──────│
  │◄─确认交易──────│                  │                │                │
```

#### 详细步骤

##### 步骤 1: 查看待验证任务

**权限**: 仅 Verifier 角色可访问

**数据获取**:
```typescript
// 过滤 Submitted 状态的任务
const submittedTasks = tasks.filter(
  task => task.status === TaskStatus.Submitted
);
```

**显示信息**:
- 任务描述
- 奖励金额
- 提交时间
- IPFS 哈希
- Worker 地址

---

##### 步骤 2: 下载并审核结果

**操作**: 从 IPFS 下载结果文件

**代码示例**:
```typescript
// 解析 IPFS 哈希
const hash = resultHash.replace('ipfs://', '');

// 通过网关访问
const url = `https://ipfs.io/ipfs/${hash}`;
// 或
const url = `https://cloudflare-ipfs.com/ipfs/${hash}`;

// 下载文件
const response = await fetch(url);
const blob = await response.blob();
```

**审核标准**:
- 是否符合任务要求
- 质量是否达标
- 是否在截止时间前完成
- 是否存在抄袭或造假

---

##### 步骤 3: 验证决定

**选项**:
- ✅ **通过**: 任务完成质量符合要求
- ❌ **拒绝**: 任务质量不合格

**合约调用**:
```solidity
function verifyTask(
    uint256 taskId,
    bool approved
) external onlyVerifier
```

**前端代码**:
```typescript
// 通过
const tx = await taskRegistry.verifyTask(taskId, true);
await tx.wait();

// 或拒绝
const tx = await taskRegistry.verifyTask(taskId, false);
await tx.wait();
```

**合约执行（通过）**:
1. 验证调用者 = Verifier
2. 验证任务状态 = Submitted
3. 更新状态 = Verified
4. 调用 Escrow.settle()
5. 自动分配资金:
   - Worker: 98%
   - Platform: 1.5%
   - Verifier: 0.5%
6. 触发 TaskVerified 事件

**合约执行（拒绝）**:
1. 更新状态 = Rejected
2. 任务重回 Assigned 状态
3. Worker 可重新提交

**Gas 消耗**:
- 约 95,000 gas
- 成本: ~$0.04

---

## 零Gas任务流程

### 流程: Creator 零Gas创建任务

#### 时序图

```
Creator      Frontend       Facilitator     TaskRegistry    X402Escrow    USDC
  │             │                │                │              │           │
  │─1.连接钱包→│                │                │              │           │
  │             │                │                │              │           │
  │─2.填写信息→│                │                │              │           │
  │             │                │                │              │           │
  │─3.启用零Gas→│                │                │              │           │
  │             │                │                │              │           │
  │─4.点击创建→│                │                │              │           │
  │             │                │                │              │           │
  │             │─5.生成签名────→│                │              │           │
  │◄──签名请求─│                │                │              │           │
  │──确认签名──→│                │                │              │           │
  │             │                │                │              │           │
  │             │─6.POST /create→│                │              │           │
  │             │                │─verifySignature│              │           │
  │             │                │─checkGasPrice──│              │           │
  │             │                │                │              │           │
  │             │                │─7.createTaskWithEIP3009()────→│           │
  │             │                │                │─transferWithAuth()──────→│
  │             │                │                │              │           │
  │             │                │                │─createPayment()────────→ │
  │             │                │                │──mint NFT────│           │
  │             │                │◄──txHash───────│              │           │
  │             │◄──taskId───────│                │              │           │
  │◄─显示成功──│                │                │              │           │
```

#### 详细步骤

##### 步骤 1-2: 连接钱包并填写信息

**与标准模式相同**

---

##### 步骤 3: 启用零 Gas 模式

**操作**: 切换"零 Gas 费模式"开关

**UI 变化**:
```tsx
{useZeroGas && (
  <Alert variant="info">
    ⚡ 零 Gas 模式已启用
    • 无需持有 ETH
    • 仅需一次签名
    • Facilitator 代付 Gas
  </Alert>
)}
```

**按钮文本变化**:
- 标准模式: "创建任务（需要 ETH）"
- 零 Gas 模式: "创建任务（零 Gas）"

---

##### 步骤 4: 生成 EIP-3009 签名

**操作**: 点击"创建任务"后自动生成签名

**签名内容**:
```typescript
import { createEIP3009Authorization } from '@/lib/eip3009/signer';

// 生成签名
const signature = await createEIP3009Authorization(
  signer,                      // Creator 的 signer
  config.contracts.usdc,       // USDC 合约地址
  config.chainId,              // 31337
  config.contracts.escrow,     // Escrow 地址
  rewardAmount                 // 奖励金额（wei）
);

// signature 包含:
// {
//   v: 28,
//   r: "0x123...",
//   s: "0x456...",
//   nonce: "0x789...",
//   validAfter: 0,
//   validBefore: 1730000000
// }
```

**EIP-712 签名结构**:
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
```

**MetaMask 提示**:
```
签名请求

USD Coin 想要您签名

from: 0xf39Fd...
to: 0xa513E...
value: 10000000 (10 USDC)
validBefore: 2025-10-25 21:00

⚠️ 这不会消耗 Gas

[取消] [签名]
```

---

##### 步骤 5: 发送到 Facilitator

**API 调用**:
```typescript
const response = await fetch(
  `${config.facilitatorUrl}/api/v1/tasks/create`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      creator: address,
      description: formData.description,
      reward: rewardAmount.toString(),
      deadline: deadlineTimestamp,
      category: formData.category,
      signature: {
        v: signature.v,
        r: signature.r,
        s: signature.s,
        nonce: signature.nonce,
        validAfter: signature.validAfter,
        validBefore: signature.validBefore,
      },
    }),
  }
);

const result = await response.json();
```

**请求体示例**:
```json
{
  "creator": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "description": "分析 DeFi 协议数据",
  "reward": "50000000",
  "deadline": 1730000000,
  "category": 4,
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

---

##### 步骤 6: Facilitator 处理

**Facilitator 服务器执行**:

1. **验证签名**:
```typescript
const verification = await verifyEIP3009Signature(
  config.contracts.usdc,
  config.chainId,
  request.creator,
  config.contracts.escrow,
  BigInt(request.reward),
  request.signature,
  provider
);

if (!verification.valid) {
  return { success: false, error: verification.error };
}
```

2. **检查 Gas 价格**:
```typescript
const feeData = await provider.getFeeData();
const currentGasPrice = feeData.gasPrice || 0n;
const maxGasPrice = ethers.parseUnits(
  config.gasLimit.maxGasPrice,
  'gwei'
);

if (currentGasPrice > maxGasPrice) {
  return {
    success: false,
    error: `Gas price too high: ${currentGwei} gwei`,
  };
}
```

3. **调用合约**:
```typescript
const tx = await taskRegistry.createTaskWithEIP3009(
  request.creator,              // 显式传入 creator
  request.description,
  BigInt(request.reward),
  request.deadline,
  request.category,
  request.signature.validAfter,
  request.signature.validBefore,
  request.signature.nonce,
  request.signature.v,
  request.signature.r,
  request.signature.s,
  { gasLimit: config.gasLimit.maxGasLimit }
);

const receipt = await tx.wait();
```

4. **提取 taskId**:
```typescript
for (const log of receipt.logs) {
  const parsed = taskRegistry.interface.parseLog({
    topics: log.topics,
    data: log.data,
  });
  
  if (parsed && parsed.name === 'TaskCreated') {
    taskId = Number(parsed.args.taskId);
    break;
  }
}
```

5. **返回结果**:
```json
{
  "success": true,
  "taskId": 1,
  "txHash": "0xabc...",
  "gasUsed": "576457"
}
```

---

##### 步骤 7: 合约执行

**TaskRegistry.createTaskWithEIP3009()**:

```solidity
function createTaskWithEIP3009(
    address creator,              // ✅ 显式参数
    string memory description,
    uint256 reward,
    uint256 deadline,
    TaskCategory category,
    uint256 validAfter,
    uint256 validBefore,
    bytes32 nonce,
    uint8 v,
    bytes32 r,
    bytes32 s
) external nonReentrant returns (uint256) {
    require(creator != address(0), "Invalid creator");
    
    // 1. USDC 通过 EIP-3009 转账
    usdc.transferWithAuthorization(
        creator,           // from: Creator (签名者)
        address(escrow),   // to: Escrow
        reward,            // value: 奖励金额
        validAfter,
        validBefore,
        nonce,
        v, r, s
    );
    
    // 2. 创建任务
    uint256 taskId = taskCount++;
    tasks[taskId] = Task({
        creator: creator,
        worker: address(0),
        description: description,
        reward: reward,
        deadline: deadline,
        category: category,
        status: TaskStatus.Open,
        resultHash: ""
    });
    
    // 3. 铸造 NFT
    _safeMint(creator, taskId);
    
    // 4. 创建托管支付
    bytes32 paymentHash = keccak256(
        abi.encodePacked(taskId, creator, reward)
    );
    
    escrow.registerExternalPayment(
        paymentHash,
        creator,         // payer
        address(this),   // payee
        usdcAddress,
        reward,
        deadline,
        taskId
    );
    
    // 5. 触发事件
    emit TaskCreated(taskId, creator, reward, category, deadline);
    
    return taskId;
}
```

**USDC.transferWithAuthorization()**:

```solidity
function transferWithAuthorization(
    address from,
    address to,
    uint256 value,
    uint256 validAfter,
    uint256 validBefore,
    bytes32 nonce,
    uint8 v,
    bytes32 r,
    bytes32 s
) external {
    // 1. 检查 nonce 未使用
    require(
        !authorizationState[from][nonce],
        "Nonce already used"
    );
    
    // 2. 检查时间窗口
    require(
        block.timestamp > validAfter,
        "Authorization not yet valid"
    );
    require(
        block.timestamp < validBefore,
        "Authorization expired"
    );
    
    // 3. 恢复签名者
    bytes32 digest = keccak256(
        abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                    from,
                    to,
                    value,
                    validAfter,
                    validBefore,
                    nonce
                )
            )
        )
    );
    
    address signer = ecrecover(digest, v, r, s);
    
    // 4. 验证签名者 == from
    require(signer == from, "Invalid signature");
    
    // 5. 标记 nonce 已使用
    authorizationState[from][nonce] = true;
    
    // 6. 执行转账
    _transfer(from, to, value);
}
```

---

##### 步骤 8: 任务创建成功

**结果与标准模式相同**:
- 任务 ID: 1
- 任务状态: Open
- USDC 托管: 50 USDC
- NFT: 铸造给 Creator

**关键差异**:
- ✅ Creator Gas 费: **$0**
- ✅ Facilitator Gas 费: ~$0.12
- ✅ 仅需 1 次签名（vs 2 次交易）
- ✅ 无需持有 ETH

---

## 状态机说明

### 任务状态枚举

```solidity
enum TaskStatus {
    Open,        // 0: 已创建，待接取
    Assigned,    // 1: 已接取，进行中
    Submitted,   // 2: 已提交，待验证
    Verified,    // 3: 已验证，待结算
    Completed,   // 4: 已完成
    Cancelled,   // 5: 已取消
    Rejected     // 6: 已拒绝
}
```

### 状态转换图

```
        ┌─────────────────────────────────────┐
        │                                     │
        │          cancel()                   │
        ↓                                     │
      Open ──────────────────────────────→ Cancelled
        │
        │ assignTask()
        ↓
    Assigned ──────────────────────────────→ Cancelled
        │                cancel()
        │ submitTask()
        ↓
    Submitted
        │
        │ verifyTask(true)     verifyTask(false)
        ├─────────────────┬──────────────────→ Rejected
        ↓                 │                        │
    Verified              │                        │
        │                 │                        │
        │ settle()        │                        │
        ↓                 │                        │
    Completed             │                        │
                          └────────────────────────┘
                                  retry
```

### 状态转换规则

| 当前状态 | 触发操作 | 目标状态 | 权限 | 条件 |
|---------|---------|---------|------|------|
| Open | assignTask() | Assigned | Any | 未过期 |
| Open | cancel() | Cancelled | Creator | 无 Worker |
| Assigned | submitTask() | Submitted | Worker | 本人 |
| Assigned | cancel() | Cancelled | Creator | 超时 |
| Submitted | verifyTask(true) | Verified | Verifier | - |
| Submitted | verifyTask(false) | Rejected | Verifier | - |
| Verified | settle() | Completed | System | 自动 |
| Rejected | submitTask() | Submitted | Worker | 重新提交 |

---

## 资金流转

### 资金流转图

```
┌───────────────────────────────────────────────────────────┐
│                    资金流转全流程                           │
└───────────────────────────────────────────────────────────┘

Creator (1000 USDC)
     │
     │ createTask() - 50 USDC
     ↓
TaskRegistry
     │
     │ transfer 50 USDC
     ↓
X402Escrow (50 USDC)
     │
     │ settle() - 任务验证通过
     │
     ├─ Worker    (49.0 USDC) ← 98%
     ├─ Platform  (0.75 USDC) ← 1.5%
     └─ Verifier  (0.25 USDC) ← 0.5%

Creator 最终余额: 950 USDC
Worker 最终余额: +49 USDC
Platform 最终余额: +0.75 USDC
Verifier 最终余额: +0.25 USDC
```

### 资金分配比例

| 角色 | 比例 | 计算 | 示例(50 USDC) |
|------|------|------|--------------|
| Worker | 98% | reward × 0.98 | 49.0 USDC |
| Platform | 1.5% | reward × 0.015 | 0.75 USDC |
| Verifier | 0.5% | reward × 0.005 | 0.25 USDC |
| **总计** | **100%** | | **50 USDC** |

### 合约代码

```solidity
// X402Escrow.settle()
function settle(
    bytes32 paymentHash,
    address agent,
    uint256 agentReward,
    uint256 agentStake
) external nonReentrant {
    Payment storage payment = payments[paymentHash];
    require(!payment.settled, "Already settled");
    
    // 计算分配金额
    uint256 totalAmount = payment.amount;
    
    // Worker: 98%
    uint256 agentAmount = (totalAmount * 98) / 100;
    
    // Platform: 1.5%
    uint256 platformFee = (totalAmount * 15) / 1000;
    
    // Verifier: 0.5%
    uint256 verifierFee = (totalAmount * 5) / 1000;
    
    // 转账
    IERC20(payment.token).transfer(agent, agentAmount);
    IERC20(payment.token).transfer(platformWallet, platformFee);
    IERC20(payment.token).transfer(verifierWallet, verifierFee);
    
    // 标记已结算
    payment.settled = true;
    
    emit PaymentSettled(paymentHash, agent, agentAmount);
}
```

---

## 异常处理

### 异常场景 1: Worker 超时未提交

**场景**: Worker 接取任务后，超过截止时间仍未提交

**处理流程**:

1. **检测超时**:
```typescript
const now = Math.floor(Date.now() / 1000);
if (task.deadline < now && task.status === TaskStatus.Assigned) {
  // 任务超时
}
```

2. **Creator 取消任务**:
```solidity
function cancel(uint256 taskId) external {
    Task storage task = tasks[taskId];
    require(msg.sender == task.creator, "Not creator");
    require(
        task.status == TaskStatus.Assigned,
        "Cannot cancel"
    );
    require(
        block.timestamp > task.deadline,
        "Not expired yet"
    );
    
    // 更新状态
    task.status = TaskStatus.Cancelled;
    
    // 退款给 Creator
    escrow.refund(paymentHash);
    
    emit TaskCancelled(taskId);
}
```

3. **资金退还**:
```solidity
// X402Escrow.refund()
function refund(bytes32 paymentHash) external {
    Payment storage payment = payments[paymentHash];
    require(!payment.settled, "Already settled");
    
    // 转回给 Creator
    IERC20(payment.token).transfer(
        payment.payer,
        payment.amount
    );
    
    payment.settled = true;
    emit PaymentRefunded(paymentHash, payment.payer);
}
```

---

### 异常场景 2: Verifier 拒绝提交

**场景**: Verifier 认为任务质量不合格，拒绝通过

**处理流程**:

1. **Verifier 拒绝**:
```solidity
function verifyTask(uint256 taskId, bool approved) external onlyVerifier {
    Task storage task = tasks[taskId];
    require(task.status == TaskStatus.Submitted, "Not submitted");
    
    if (!approved) {
        // 拒绝
        task.status = TaskStatus.Rejected;
        emit TaskRejected(taskId, msg.sender);
    } else {
        // 通过
        task.status = TaskStatus.Verified;
        escrow.settle(...);
        emit TaskVerified(taskId, msg.sender);
    }
}
```

2. **Worker 重新提交**:
```solidity
function submitTask(uint256 taskId, string memory resultHash) external {
    Task storage task = tasks[taskId];
    require(msg.sender == task.worker, "Not worker");
    require(
        task.status == TaskStatus.Assigned ||
        task.status == TaskStatus.Rejected,  // ✅ 允许重新提交
        "Cannot submit"
    );
    
    task.resultHash = resultHash;
    task.status = TaskStatus.Submitted;
    
    emit TaskSubmitted(taskId, msg.sender, resultHash);
}
```

3. **限制重试次数** (可选):
```solidity
// 添加字段
struct Task {
    // ...
    uint8 submissionCount;  // 提交次数
}

// 限制
require(task.submissionCount < 3, "Max retries exceeded");
task.submissionCount++;
```

---

### 异常场景 3: Facilitator 服务宕机

**场景**: 零 Gas 模式下，Facilitator 服务器宕机

**影响**: 用户无法使用零 Gas 创建任务

**解决方案**:

**选项 1: 切换到标准模式**
```typescript
if (!facilitatorAvailable) {
  setUseZeroGas(false);
  alert("Facilitator 暂时不可用，请使用标准模式");
}
```

**选项 2: 使用备用 Facilitator**
```typescript
const facilitators = [
  "https://facilitator1.x402.io",
  "https://facilitator2.x402.io",
  "https://facilitator3.x402.io",
];

async function createWithRetry() {
  for (const url of facilitators) {
    try {
      const response = await fetch(`${url}/api/v1/tasks/create`, {...});
      if (response.ok) return await response.json();
    } catch (e) {
      continue;
    }
  }
  throw new Error("All facilitators unavailable");
}
```

**选项 3: 等待恢复**
```typescript
<Alert variant="warning">
  ⚠️ 零 Gas 服务暂时不可用
  请稍后重试或使用标准模式创建
</Alert>
```

---

### 异常场景 4: Gas 价格过高

**场景**: Facilitator 检测到 Gas 价格超过阈值

**处理流程**:

1. **Facilitator 拒绝**:
```typescript
const maxGasPrice = ethers.parseUnits('100', 'gwei');
if (currentGasPrice > maxGasPrice) {
  return {
    success: false,
    error: `Gas price too high: ${currentGwei} gwei`,
  };
}
```

2. **前端提示用户**:
```typescript
if (!result.success && result.error.includes('Gas price')) {
  alert(`
    当前 Gas 价格过高，零 Gas 模式暂时不可用。
    
    请选择:
    1. 稍后重试
    2. 使用标准模式创建
  `);
}
```

---

### 异常场景 5: 签名验证失败

**场景**: Facilitator 验证签名时失败

**可能原因**:
- 签名格式错误
- Nonce 已使用
- 签名已过期
- chainId 不匹配

**处理流程**:

1. **Facilitator 返回详细错误**:
```typescript
const verification = await verifyEIP3009Signature(...);

if (!verification.valid) {
  return {
    success: false,
    error: verification.error,  // 详细错误信息
    code: verification.code,    // 错误代码
  };
}
```

2. **前端根据错误码处理**:
```typescript
switch (result.code) {
  case 'NONCE_USED':
    alert('签名已被使用，请重新创建任务');
    break;
  case 'EXPIRED':
    alert('签名已过期，请重新签名');
    break;
  case 'INVALID_SIGNATURE':
    alert('签名验证失败，请检查钱包设置');
    break;
  default:
    alert(`创建失败: ${result.error}`);
}
```

---

## 总结

### 关键流程对比

| 流程 | 标准模式 | 零 Gas 模式 |
|------|----------|-------------|
| 用户操作 | 2次交易确认 | 1次签名 |
| Gas 成本 | ~$0.05 | $0 |
| 需要 ETH | 是 | 否 |
| 完成时间 | ~6秒 | ~5秒 |
| 技术复杂度 | 低 | 中 |

### 优化建议

1. **批量操作**: 支持一次签名创建多个任务
2. **自动重试**: Facilitator 调用失败时自动重试
3. **Gas 预测**: 前端显示预估 Gas 费用
4. **状态同步**: 实时同步任务状态变化
5. **通知系统**: 任务状态变更时推送通知

---

**文档版本**: 1.0.0  
**发布日期**: 2025-10-25  
**作者**: X402 团队

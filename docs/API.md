# X402 API 文档

**版本**: 1.0.0  
**最后更新**: 2025-10-25

---

## API 概览

X402 提供三类 API：

1. **Facilitator REST API** - 零 Gas 费服务
2. **Smart Contract ABI** - 智能合约接口
3. **Frontend Hooks API** - React Hooks

---

## 1. Facilitator REST API

**Base URL**: `http://localhost:3001` (开发环境)

### 1.1 健康检查

**端点**: `GET /health`

**描述**: 检查 Facilitator 服务健康状态

**请求**: 无参数

**响应**:
```json
{
  "status": "ok",
  "chainId": 31337,
  "contracts": {
    "taskRegistry": "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",
    "escrow": "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
    "usdc": "0x0165878A594ca255338adfa4d48449f69242Eb8F"
  }
}
```

### 1.2 创建任务（零 Gas）

**端点**: `POST /api/v1/tasks/create`

**描述**: 使用 EIP-3009 签名创建任务

**请求体**:
```typescript
{
  creator: string;           // Creator 地址
  description: string;       // 任务描述
  reward: string;            // 奖励（wei字符串）
  deadline: number;          // 截止时间戳
  category: number;          // 任务分类 (0-5)
  signature: {
    v: number;
    r: string;
    s: string;
    nonce: string;
    validAfter: number;
    validBefore: number;
  };
}
```

**示例请求**:
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

**成功响应** (200):
```json
{
  "success": true,
  "taskId": 1,
  "txHash": "0xabc...",
  "gasUsed": "576457"
}
```

**错误响应** (400/500):
```json
{
  "success": false,
  "error": "Invalid signature",
  "code": "INVALID_SIGNATURE"
}
```

**错误码**:
- `INVALID_SIGNATURE`: 签名无效
- `NONCE_USED`: Nonce 已使用
- `EXPIRED`: 签名已过期
- `GAS_PRICE_TOO_HIGH`: Gas 价格过高
- `TRANSACTION_FAILED`: 交易失败

---

## 2. Smart Contract ABI

### 2.1 TaskRegistry

**地址**: 见 `app/lib/config.json`

#### createTask

**函数签名**:
```solidity
function createTask(
    string memory description,
    uint256 reward,
    uint256 deadline,
    TaskCategory category
) external returns (uint256 taskId)
```

**参数**:
- `description`: 任务描述
- `reward`: 奖励金额（USDC wei，6位小数）
- `deadline`: 截止时间戳
- `category`: 任务分类（0-5）

**返回**: 任务 ID

**事件**:
```solidity
event TaskCreated(
    uint256 indexed taskId,
    address indexed creator,
    uint256 reward,
    TaskCategory category,
    uint256 deadline
)
```

#### createTaskWithEIP3009

**函数签名**:
```solidity
function createTaskWithEIP3009(
    address creator,
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
) external returns (uint256 taskId)
```

#### assignTask

**函数签名**:
```solidity
function assignTask(uint256 taskId) external
```

**事件**:
```solidity
event TaskAssigned(uint256 indexed taskId, address indexed worker)
```

#### submitTask

**函数签名**:
```solidity
function submitTask(uint256 taskId, string memory resultHash) external
```

**事件**:
```solidity
event TaskSubmitted(
    uint256 indexed taskId,
    address indexed worker,
    string resultHash
)
```

#### verifyTask

**函数签名**:
```solidity
function verifyTask(uint256 taskId, bool approved) external
```

**修饰符**: `onlyVerifier`

**事件**:
```solidity
event TaskVerified(uint256 indexed taskId, address indexed verifier)
event TaskRejected(uint256 indexed taskId, address indexed verifier)
```

---

### 2.2 X402Escrow

#### settle

**函数签名**:
```solidity
function settle(
    bytes32 paymentHash,
    address agent,
    uint256 agentReward,
    uint256 agentStake
) external
```

**事件**:
```solidity
event PaymentSettled(
    bytes32 indexed paymentHash,
    address indexed agent,
    uint256 amount
)
```

---

## 3. Frontend Hooks API

### useTaskRegistry

**位置**: `app/hooks/useTaskRegistry.ts`

**用法**:
```typescript
const { createTask, assignTask, submitTask } = useTaskRegistry();

// 创建任务
await createTask({
  description: "...",
  reward: ethers.parseUnits("50", 6),
  deadline: Math.floor(Date.now() / 1000) + 86400 * 7,
  category: 0,
});
```

### useUSDC

**位置**: `app/hooks/useUSDC.ts`

**用法**:
```typescript
const { approve, balanceOf } = useUSDC();

// 授权
await approve(taskRegistryAddress, amount);

// 查询余额
const balance = await balanceOf(userAddress);
```

---

## 完整示例

### 零 Gas 创建任务（前端）

```typescript
import { createEIP3009Authorization } from '@/lib/eip3009/signer';
import { useWalletClient, useAccount } from 'wagmi';
import { ethers } from 'ethers';

export default function CreateTaskPage() {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  
  const handleCreateZeroGas = async (formData) => {
    // 1. 生成签名
    const provider = new ethers.BrowserProvider(walletClient);
    const signer = await provider.getSigner();
    
    const signature = await createEIP3009Authorization(
      signer,
      config.contracts.usdc,
      config.chainId,
      config.contracts.escrow,
      ethers.parseUnits(formData.reward, 6)
    );
    
    // 2. 发送到 Facilitator
    const response = await fetch(
      `${config.facilitatorUrl}/api/v1/tasks/create`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator: address,
          description: formData.description,
          reward: ethers.parseUnits(formData.reward, 6).toString(),
          deadline: Math.floor(formData.deadline.getTime() / 1000),
          category: formData.category,
          signature,
        }),
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      alert(`任务创建成功！ID: ${result.taskId}`);
    } else {
      alert(`创建失败: ${result.error}`);
    }
  };
}
```

---

**文档版本**: 1.0.0  
**发布日期**: 2025-10-25

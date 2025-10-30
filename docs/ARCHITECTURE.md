# X402 系统架构文档

**版本**: 1.0.0  
**最后更新**: 2025-10-25  
**文档类型**: 技术架构文档

---

## 📑 目录

- [系统概览](#系统概览)
- [技术栈](#技术栈)
- [分层架构](#分层架构)
- [核心组件](#核心组件)
- [数据模型](#数据模型)
- [安全架构](#安全架构)
- [部署架构](#部署架构)

---

## 系统概览

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户层                                    │
│   Creator          Worker          Verifier          Admin       │
└────────────────────────────┬────────────────────────────────────┘
                            │
                            │ HTTPS/WebSocket
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                      前端层 (Frontend)                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Next.js 14 App (React 18 + TypeScript)                 │  │
│  │  • SSR/SSG                                                │  │
│  │  • Client Components                                      │  │
│  │  • Server Components                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  UI Components                                            │  │
│  │  • 任务列表/详情                                          │  │
│  │  • 创建任务（标准/零Gas）                                │  │
│  │  • 控制面板                                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Web3 集成层                                              │  │
│  │  • wagmi v2 (React Hooks)                                │  │
│  │  • RainbowKit (钱包连接)                                 │  │
│  │  • ethers.js v6 (签名)                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        │ Web3 RPC          │ HTTP API          │ IPFS
        ↓                   ↓                   ↓
┌───────────────┐ ┌──────────────────┐ ┌──────────────┐
│   区块链层     │ │ Facilitator 层   │ │  存储层      │
│               │ │                  │ │              │
│  Base L2      │ │  Express Server  │ │  IPFS        │
│  • Hardhat    │ │  • 签名验证      │ │  • 结果文件  │
│  • Base       │ │  • 交易代付      │ │  • 元数据    │
│               │ │  • Rate Limit    │ │              │
└───────┬───────┘ └────────┬─────────┘ └──────────────┘
        │                  │
        ↓                  ↓
┌──────────────────────────────────────┐
│         智能合约层                     │
│  ┌────────────────────────────────┐ │
│  │  TaskRegistry.sol              │ │
│  │  • 任务管理                     │ │
│  │  • NFT 铸造                    │ │
│  │  • 零Gas集成                   │ │
│  └────────────────────────────────┘ │
│  ┌────────────────────────────────┐ │
│  │  X402Escrow.sol                │ │
│  │  • 资金托管                     │ │
│  │  • 自动结算                     │ │
│  │  • 外部支付记录                 │ │
│  └────────────────────────────────┘ │
│  ┌────────────────────────────────┐ │
│  │  MockUSDC.sol (测试)           │ │
│  │  • EIP-3009                    │ │
│  │  • transferWithAuthorization   │ │
│  └────────────────────────────────┘ │
└──────────────────────────────────────┘
```

---

## 技术栈

### 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 14 | React 框架 (App Router) |
| **React** | 18 | UI 库 |
| **TypeScript** | 5.0 | 类型安全 |
| **wagmi** | 2.12 | React Hooks for Ethereum |
| **RainbowKit** | 2.1 | 钱包连接 UI |
| **ethers.js** | v6 | 以太坊 SDK |
| **Tailwind CSS** | 3 | CSS 框架 |
| **shadcn/ui** | - | UI 组件库 |

### 后端技术栈 (Facilitator)

| 技术 | 版本 | 用途 |
|------|------|------|
| **Node.js** | 22+ | 运行时环境 |
| **Express.js** | 4 | Web 框架 |
| **TypeScript** | 5.0 | 类型安全 |
| **ethers.js** | v6 | 以太坊 SDK |
| **express-rate-limit** | 7 | Rate limiting |
| **cors** | 2 | 跨域支持 |

### 智能合约技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Solidity** | 0.8.24 | 智能合约语言 |
| **Hardhat** | 2.26 | 开发框架 |
| **OpenZeppelin** | 5.1 | 合约库 |
| **ethers.js** | v6 | 部署和测试 |

### 基础设施

| 技术 | 用途 |
|------|------|
| **Base L2** | 区块链网络 (主网/测试网) |
| **Hardhat Network** | 本地测试网 |
| **IPFS** | 去中心化存储 |
| **Vercel** | 前端部署 (推荐) |
| **AWS/GCP** | Facilitator 部署 |

---

## 分层架构

### 1. 表示层 (Presentation Layer)

**职责**: 用户交互和展示

**组件**:

```
app/
├── (pages)/
│   ├── page.tsx                  # 首页
│   ├── tasks/
│   │   ├── page.tsx             # 任务列表
│   │   └── [id]/page.tsx        # 任务详情
│   ├── create/
│   │   └── page.tsx             # 创建任务（含零Gas）
│   └── dashboard/
│       └── page.tsx             # 控制面板
├── components/                   # UI 组件
│   ├── TaskCard.tsx
│   ├── TaskForm.tsx
│   ├── ZeroGasToggle.tsx
│   └── ...
└── lib/
    ├── wagmi.ts                 # Web3 配置
    ├── config.json              # 合约配置
    └── eip3009/
        └── signer.ts            # 前端签名库
```

**技术选型理由**:
- **Next.js 14 App Router**: SSR/SSG 优化 SEO，提升首屏加载速度
- **React Server Components**: 减少客户端 JavaScript，提升性能
- **TypeScript**: 类型安全，减少运行时错误
- **wagmi**: React Hooks 简化 Web3 集成

---

### 2. 业务逻辑层 (Business Logic Layer)

**职责**: 封装业务逻辑和合约交互

**组件**:

```
app/hooks/
├── useTaskRegistry.ts           # TaskRegistry 合约交互
│   ├── createTask()
│   ├── assignTask()
│   ├── submitTask()
│   ├── verifyTask()
│   └── ...
├── useUSDC.ts                   # USDC 代币操作
│   ├── approve()
│   ├── balanceOf()
│   ├── allowance()
│   └── ...
└── useTasks.ts                  # 批量任务数据
    ├── useAllTasks()
    ├── useUserTasks()
    └── ...
```

**核心 Hook 示例**:

```typescript
// useTaskRegistry.ts
export function useTaskRegistry() {
  const config = useConfig();
  
  // 写操作: 创建任务
  const { writeContract } = useWriteContract();
  
  const createTask = async (
    description: string,
    reward: bigint,
    deadline: number,
    category: number
  ) => {
    return writeContract({
      address: config.contracts.taskRegistry,
      abi: TaskRegistryABI,
      functionName: 'createTask',
      args: [description, reward, deadline, category],
    });
  };
  
  // 读操作: 获取任务
  const { data: task } = useReadContract({
    address: config.contracts.taskRegistry,
    abi: TaskRegistryABI,
    functionName: 'tasks',
    args: [taskId],
  });
  
  return { createTask, task, ... };
}
```

---

### 3. Facilitator 服务层

**职责**: 零 Gas 费中继服务

**架构**:

```
packages/facilitator/
├── src/
│   ├── server.ts                # Express 服务器
│   ├── config.ts                # 配置加载
│   ├── types.ts                 # TypeScript 类型
│   ├── routes/
│   │   ├── create-task.ts       # POST /api/v1/tasks/create
│   │   └── health.ts            # GET /health
│   └── services/
│       ├── transaction.ts       # 交易处理
│       └── signature.ts         # 签名验证
├── config.json                  # 配置文件
└── package.json
```

**请求处理流程**:

```
Client Request
    ↓
Rate Limiting (100 req/hour)
    ↓
CORS Validation
    ↓
Body Parsing (JSON)
    ↓
Request Handler (/api/v1/tasks/create)
    ↓
1. Verify Signature
    ├─ EIP-712 domain
    ├─ Recover signer
    └─ Validate signature
    ↓
2. Check Gas Price
    ├─ Get current gas price
    └─ Compare with max (100 gwei)
    ↓
3. Call Contract
    ├─ createTaskWithEIP3009()
    └─ Wait for confirmation
    ↓
4. Extract Task ID
    ├─ Parse TaskCreated event
    └─ Return task ID
    ↓
Response (JSON)
```

**安全机制**:
- Rate Limiting: 限制每 IP 每小时请求数
- Gas Limit: 最大 Gas 价格和 Gas limit
- 签名验证: 防止伪造请求
- Error Handling: 完整的错误处理

---

### 4. 智能合约层 (Smart Contract Layer)

**职责**: 链上业务逻辑和资金管理

**合约架构**:

```
packages/contracts/contracts/
├── TaskRegistry.sol             # 主合约
│   ├── ERC721                   # 任务 NFT
│   ├── ReentrancyGuard          # 防重入
│   ├── Pausable                 # 紧急暂停
│   └── AccessControl            # 权限管理
├── X402Escrow.sol               # 托管合约
│   ├── ReentrancyGuard
│   ├── Pausable
│   └── AccessControl
├── MockUSDC.sol                 # 测试代币
│   ├── ERC20
│   └── EIP-3009
└── interfaces/
    ├── ITaskRegistry.sol
    ├── IX402Escrow.sol
    └── IEIP3009.sol
```

**合约关系图**:

```
┌─────────────────────────────────────────────┐
│          TaskRegistry (ERC721)              │
│  • 任务管理                                  │
│  • NFT 铸造                                  │
│  • 状态机                                    │
└───────────┬─────────────────────────────────┘
            │ owns
            │ calls
            ↓
┌─────────────────────────────────────────────┐
│           X402Escrow                        │
│  • 资金托管                                  │
│  • 自动结算                                  │
│  • 支付记录                                  │
└───────────┬─────────────────────────────────┘
            │ transfers
            ↓
┌─────────────────────────────────────────────┐
│          USDC (ERC20 + EIP-3009)            │
│  • USDC 代币                                 │
│  • transferWithAuthorization                │
└─────────────────────────────────────────────┘
```

---

## 核心组件

### 组件 1: TaskRegistry 合约

**职责**: 任务生命周期管理

**核心功能**:

```solidity
contract TaskRegistry is ERC721, ReentrancyGuard, Pausable {
    // 任务结构
    struct Task {
        address creator;
        address worker;
        string description;
        uint256 reward;
        uint256 deadline;
        TaskCategory category;
        TaskStatus status;
        string resultHash;
    }
    
    // 状态枚举
    enum TaskStatus { Open, Assigned, Submitted, Verified, Completed, Cancelled, Rejected }
    
    // 存储
    mapping(uint256 => Task) public tasks;
    uint256 public taskCount;
    
    // 核心函数
    function createTask(...) external returns (uint256);
    function createTaskWithEIP3009(...) external returns (uint256);  // 零Gas
    function assignTask(uint256 taskId) external;
    function submitTask(uint256 taskId, string memory resultHash) external;
    function verifyTask(uint256 taskId, bool approved) external;
    function cancel(uint256 taskId) external;
}
```

**设计模式**:
- **状态机**: 严格的状态转换规则
- **事件驱动**: 所有状态变更触发事件
- **访问控制**: onlyVerifier 修饰符
- **防御性编程**: require 检查所有前置条件

---

### 组件 2: X402Escrow 合约

**职责**: 资金托管和自动结算

**核心功能**:

```solidity
contract X402Escrow is ReentrancyGuard, Pausable {
    // 支付结构
    struct Payment {
        address payer;
        address payee;
        address token;
        uint256 amount;
        uint256 deadline;
        uint256 taskId;
        bool settled;
    }
    
    // 存储
    mapping(bytes32 => Payment) public payments;
    
    // 核心函数
    function createPayment(...) external;
    function registerExternalPayment(...) external;  // 零Gas支付记录
    function settle(...) external;
    function refund(bytes32 paymentHash) external;
}
```

**结算逻辑**:

```solidity
function settle(bytes32 paymentHash, address agent, ...) external {
    Payment storage payment = payments[paymentHash];
    require(!payment.settled, "Already settled");
    
    uint256 total = payment.amount;
    
    // 分配比例
    uint256 agentAmount = (total * 98) / 100;       // 98%
    uint256 platformFee = (total * 15) / 1000;      // 1.5%
    uint256 verifierFee = (total * 5) / 1000;       // 0.5%
    
    // 转账
    IERC20(payment.token).transfer(agent, agentAmount);
    IERC20(payment.token).transfer(platformWallet, platformFee);
    IERC20(payment.token).transfer(verifierWallet, verifierFee);
    
    payment.settled = true;
}
```

---

### 组件 3: 前端签名库

**职责**: EIP-3009 签名生成

**实现** (`app/lib/eip3009/signer.ts`):

```typescript
export async function createEIP3009Authorization(
  signer: ethers.Signer,
  usdcAddress: string,
  chainId: number,
  to: string,
  value: bigint,
  validUntilTimestamp?: number
): Promise<EIP3009Signature> {
  // 1. 获取签名者地址
  const from = await signer.getAddress();
  
  // 2. 生成随机 nonce
  const nonce = '0x' + crypto.randomBytes(32).toString('hex');
  
  // 3. 设置时间窗口
  const validAfter = 0;
  const validBefore = validUntilTimestamp || 
    Math.floor(Date.now() / 1000) + 3600;
  
  // 4. EIP-712 Domain
  const domain = {
    name: 'USD Coin',
    version: '1',
    chainId,
    verifyingContract: usdcAddress,
  };
  
  // 5. EIP-712 Types
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
  
  // 6. Message
  const message = {
    from,
    to,
    value: value.toString(),
    validAfter,
    validBefore,
    nonce,
  };
  
  // 7. 签名
  const signature = await signer.signTypedData(domain, types, message);
  const sig = ethers.Signature.from(signature);
  
  return {
    v: sig.v,
    r: sig.r,
    s: sig.s,
    nonce,
    validAfter,
    validBefore,
  };
}
```

---

## 数据模型

### 链上数据模型

#### Task 结构

```solidity
struct Task {
    address creator;         // 任务创建者
    address worker;          // 任务执行者
    string description;      // 任务描述
    uint256 reward;          // 奖励金额 (USDC, 6 decimals)
    uint256 deadline;        // 截止时间 (Unix timestamp)
    TaskCategory category;   // 任务分类
    TaskStatus status;       // 任务状态
    string resultHash;       // 结果哈希 (IPFS)
}
```

**字段说明**:

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| creator | address | 任务发起者地址 | 0xf39F... |
| worker | address | 执行者地址（初始为 0x0） | 0x7099... |
| description | string | 任务描述 | "分析 DeFi 数据" |
| reward | uint256 | 奖励金额（wei，6位小数） | 50000000 (50 USDC) |
| deadline | uint256 | Unix 时间戳 | 1730000000 |
| category | enum | 任务类型 | Development |
| status | enum | 当前状态 | Open |
| resultHash | string | IPFS 哈希 | ipfs://Qm... |

---

#### Payment 结构

```solidity
struct Payment {
    address payer;           // 支付者
    address payee;           // 接收者
    address token;           // 代币地址 (USDC)
    uint256 amount;          // 金额
    uint256 deadline;        // 截止时间
    uint256 taskId;          // 关联任务ID
    bool settled;            // 是否已结算
}
```

---

### 链下数据模型 (前端/Facilitator)

#### CreateTaskRequest (Facilitator)

```typescript
interface CreateTaskRequest {
  creator: string;           // Creator 地址
  description: string;       // 任务描述
  reward: string;            // 奖励金额 (字符串，避免精度问题)
  deadline: number;          // 截止时间戳
  category: number;          // 任务分类
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

#### FacilitatorConfig

```typescript
interface FacilitatorConfig {
  port: number;
  rpcUrl: string;
  chainId: number;
  privateKey: string;
  contracts: {
    taskRegistry: string;
    escrow: string;
    usdc: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  gasLimit: {
    maxGasPrice: string;     // gwei
    maxGasLimit: number;
  };
}
```

---

## 安全架构

### 1. 智能合约安全

#### 防重入攻击

```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TaskRegistry is ReentrancyGuard {
    function createTask(...) external nonReentrant returns (uint256) {
        // 函数体
    }
}
```

#### 紧急暂停

```solidity
import "@openzeppelin/contracts/security/Pausable.sol";

contract TaskRegistry is Pausable {
    function createTask(...) external whenNotPaused returns (uint256) {
        // 函数体
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
}
```

#### 访问控制

```solidity
modifier onlyVerifier() {
    require(msg.sender == verifier, "Not verifier");
    _;
}

function verifyTask(...) external onlyVerifier {
    // 仅 Verifier 可调用
}
```

---

### 2. Facilitator 安全

#### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,    // 1 hour
  max: config.rateLimit.maxRequests,      // 100 requests
  message: 'Too many requests',
});

app.use('/api/', limiter);
```

#### Gas Limit 控制

```typescript
// 检查 Gas 价格
const maxGasPrice = ethers.parseUnits(
  config.gasLimit.maxGasPrice,
  'gwei'
);

if (currentGasPrice > maxGasPrice) {
  return { success: false, error: 'Gas price too high' };
}

// 设置 Gas Limit
const tx = await contract.method({
  gasLimit: config.gasLimit.maxGasLimit,
});
```

#### 签名验证

```typescript
async function verifyEIP3009Signature(...): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    // 1. 构造 digest
    const digest = ethers.keccak256(...);
    
    // 2. 恢复签名者
    const signer = ethers.recoverAddress(digest, signature);
    
    // 3. 验证签名者 == from
    if (signer.toLowerCase() !== from.toLowerCase()) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
```

---

### 3. 前端安全

#### XSS 防护

- React 自动转义输出
- 使用 `dangerouslySetInnerHTML` 时进行清理
- Content Security Policy (CSP)

#### CSRF 防护

- SameSite Cookie
- CORS 配置

#### 输入验证

```typescript
// 验证 IPFS 哈希格式
const ipfsRegex = /^(ipfs:\/\/)?(Qm[1-9A-HJ-NP-Za-km-z]{44})$/;
if (!ipfsRegex.test(hash)) {
  throw new Error('Invalid IPFS hash');
}

// 验证金额范围
if (reward < 1 || reward > 1000000) {
  throw new Error('Invalid reward amount');
}
```

---

## 部署架构

### 本地开发环境

```
┌────────────────────────────────────────┐
│         开发机 (localhost)              │
│  ┌──────────────────────────────────┐ │
│  │  Hardhat Network (chainId 31337)│ │
│  │  • MockUSDC                      │ │
│  │  • TaskRegistry                  │ │
│  │  • X402Escrow                    │ │
│  │  Port: 8545                      │ │
│  └──────────────────────────────────┘ │
│  ┌──────────────────────────────────┐ │
│  │  Facilitator Server              │ │
│  │  • Express API                   │ │
│  │  Port: 3001                      │ │
│  └──────────────────────────────────┘ │
│  ┌──────────────────────────────────┐ │
│  │  Next.js Dev Server              │ │
│  │  • Frontend                      │ │
│  │  Port: 3000                      │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
```

---

### 生产环境（推荐架构）

```
┌────────────────────────────────────────────────────────┐
│                   CDN (Cloudflare)                     │
│                     静态资源缓存                         │
└─────────────────────┬──────────────────────────────────┘
                      │
┌─────────────────────┴──────────────────────────────────┐
│                  Load Balancer                          │
│                   (AWS ALB / NGINX)                     │
└─────────────────────┬──────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
┌───────┴───────┐         ┌─────────┴─────────┐
│   Frontend    │         │   Facilitator     │
│   (Vercel)    │         │   (AWS EC2 * 3)   │
│               │         │   • Primary       │
│ • Next.js SSR │         │   • Replica 1     │
│ • Edge Cache  │         │   • Replica 2     │
└───────┬───────┘         └─────────┬─────────┘
        │                           │
        │                           │
        └────────┬──────────────────┘
                 │
┌────────────────┴────────────────────────────────┐
│             Base L2 Blockchain                  │
│  ┌──────────────────────────────────────────┐ │
│  │  Smart Contracts                         │ │
│  │  • TaskRegistry                          │ │
│  │  • X402Escrow                            │ │
│  │  • USDC (Circle)                         │ │
│  └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│             IPFS Network                         │
│  • Pinata / Web3.Storage                        │
│  • 任务结果存储                                  │
└─────────────────────────────────────────────────┘
```

**组件说明**:

| 组件 | 技术选型 | 规格 | 成本 |
|------|----------|------|------|
| 前端 | Vercel | Hobby / Pro | $0-20/月 |
| Facilitator | AWS EC2 | t3.small * 3 | ~$30/月 |
| Load Balancer | AWS ALB | - | ~$20/月 |
| 区块链 | Base L2 | - | 按 Gas 计费 |
| IPFS | Pinata | 1GB | $0-20/月 |
| 监控 | CloudWatch | - | ~$10/月 |
| **总计** | | | **~$80-100/月** |

---

## 总结

### 架构优势

1. **模块化**: 前端、后端、合约分离，独立开发和部署
2. **可扩展**: 水平扩展 Facilitator，支持更多用户
3. **安全性**: 多层安全机制，防御常见攻击
4. **高性能**: Next.js SSR/SSG，CDN 加速
5. **低成本**: 零 Gas 费降低用户成本

### 技术债务

- [ ] Facilitator 单点故障（需要集群和负载均衡）
- [ ] 缺少数据库（所有数据从链上读取）
- [ ] 缺少缓存层（频繁查询区块链）
- [ ] 缺少监控和告警系统
- [ ] 缺少日志聚合

### 未来优化方向

1. **数据层**: 引入 PostgreSQL 缓存链上数据
2. **缓存层**: Redis 缓存热点数据
3. **监控**: Grafana + Prometheus
4. **日志**: ELK Stack
5. **CI/CD**: GitHub Actions 自动部署

---

**文档版本**: 1.0.0  
**发布日期**: 2025-10-25  
**作者**: X402 团队

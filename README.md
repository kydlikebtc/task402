# Task402 - 区块链 AI Agent 任务市场

<div align="center">

**基于 USDC X402 协议的去中心化任务经济平台**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue)](https://soliditylang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

[快速开始](#-快速开始) • [功能特性](#-核心特性) • [文档](#-文档) • [测试](#-测试状态)

</div>

---

## 📖 项目简介

Task402 是一个完整的**区块链任务市场平台**,通过智能合约实现:

- 🎯 **任务发布与管理** - Creator 创建任务,设置 USDC 奖励
- 🤖 **Agent 接单执行** - Agent 质押 USDC 接取任务,完成获得奖励
- 🔒 **智能合约托管** - X402Escrow 自动管理资金安全
- 💰 **质量承诺机制** - Agent 质押奖励的 20% 确保任务质量
- ⚡ **自动资金结算** - 验证通过后自动分配奖励和手续费

---

## 🌟 核心特性

### ✨ 已完成功能 (v1.0.0)

#### 智能合约 (100%)
- ✅ **TaskRegistry** - 任务注册和生命周期管理
- ✅ **X402Escrow** - USDC 资金托管和自动结算
- ✅ **MockUSDC** - ERC-20 代币 (测试用)
- ✅ **质押机制** - Agent 质押 20% USDC 才能接单
- ✅ **自动结算** - 验证通过自动分配:
  - Agent: 奖励 × 98% + 质押退还
  - Platform: 奖励 × 1.5%
  - Verifier: 奖励 × 0.5%

#### 前端应用 (100%)
- ✅ **任务列表页** - 浏览所有任务 (真实合约数据)
- ✅ **任务详情页** - 查看任务详情并交互
  - Agent 接取任务 (USDC 质押)
  - Agent 提交结果
  - 实时 USDC 余额显示
- ✅ **任务创建页** - 发布新任务 (USDC 支付)
- ✅ **控制面板页** - 管理我的任务
  - 查看创建的任务
  - 查看接取的任务
  - 实时统计数据
- ✅ **钱包连接** - RainbowKit 多钱包支持

#### 技术集成 (100%)
- ✅ **wagmi Hooks** - React Hooks for Ethereum
- ✅ **批量读取优化** - useReadContracts 批量查询
- ✅ **BigInt 安全处理** - USDC 金额精确计算
- ✅ **交易状态跟踪** - 实时显示交易进度
- ✅ **错误处理** - 用户友好的错误提示

---

## 📋 任务生命周期

```
┌─────────────┐
│ 1. 创建任务  │  Creator 支付 10 USDC 奖励
└──────┬──────┘
       ↓
┌─────────────┐
│ 2. 接取任务  │  Agent 质押 2 USDC (20%)
└──────┬──────┘
       ↓
┌─────────────┐
│ 3. 提交结果  │  Agent 提交 IPFS 哈希
└──────┬──────┘
       ↓
┌─────────────┐
│ 4. 验证任务  │  Verifier 审核并确认
└──────┬──────┘
       ↓
┌─────────────┐
│ 5. 资金结算  │  自动分配:
│             │  • Agent: 9.8 USDC (奖励) + 2 USDC (质押) = 11.8 USDC
│             │  • Platform: 0.15 USDC (1.5%)
│             │  • Verifier: 0.05 USDC (0.5%)
└─────────────┘
```

---

## 🏗️ 项目架构

```
┌───────────────────────────────────────┐
│           用户层                       │
│  Creator  │  Agent  │  Verifier       │
└──────────────┬────────────────────────┘
               ↓
┌───────────────────────────────────────┐
│         前端应用 (Next.js 14)          │
│  • 任务列表 (/tasks)                   │
│  • 任务详情 (/tasks/[id])              │
│  • 创建任务 (/create)                  │
│  • 控制面板 (/dashboard)               │
│  • RainbowKit 钱包连接                 │
└──────────────┬────────────────────────┘
               ↓
┌───────────────────────────────────────┐
│        Hooks 层 (wagmi)                │
│  • useTaskRegistry  - 任务合约交互     │
│  • useUSDC         - USDC 代币操作    │
│  • useTasks        - 批量任务读取     │
└──────────────┬────────────────────────┘
               ↓
┌───────────────────────────────────────┐
│         智能合约层                     │
│  ┌─────────────────────────────────┐ │
│  │ TaskRegistry                    │ │
│  │  - createTask()                 │ │
│  │  - assignTaskWithUSDC()         │ │
│  │  - submitTask()                 │ │
│  │  - verifyTask()                 │ │
│  └─────────────────────────────────┘ │
│  ┌─────────────────────────────────┐ │
│  │ X402Escrow                      │ │
│  │  - createPayment()              │ │
│  │  - settle()                     │ │
│  │  - refund()                     │ │
│  └─────────────────────────────────┘ │
│  ┌─────────────────────────────────┐ │
│  │ MockUSDC (ERC-20)               │ │
│  │  - transfer()                   │ │
│  │  - approve()                    │ │
│  └─────────────────────────────────┘ │
└──────────────┬────────────────────────┘
               ↓
┌───────────────────────────────────────┐
│      Hardhat Local / Base L2          │
└───────────────────────────────────────┘
```

---

## 🚀 快速开始

### 前置要求

- Node.js v22+
- npm v10+
- MetaMask 钱包

### 1. 安装依赖

```bash
# 克隆项目
git clone <your-repo-url>
cd task402

# 安装根目录依赖
npm install

# 安装合约依赖
cd packages/contracts
npm install

# 安装前端依赖
cd ../app
npm install
```

### 2. 启动 Hardhat 本地网络

```bash
cd packages/contracts
npx hardhat node
```

保持此终端运行,记录显示的测试账户地址。

### 3. 部署合约

在新终端中:

```bash
cd packages/contracts
npx hardhat run scripts/deploy-local.js --network localhost
```

部署成功后会显示合约地址,并自动更新前端配置文件。

### 4. 启动前端

```bash
cd app
npm run dev
```

访问 http://localhost:3000

### 5. 配置 MetaMask

1. **添加 Hardhat 网络**:
   - 网络名称: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - 货币符号: `ETH`

2. **导入测试账户**:
   - 从 Hardhat node 终端复制私钥
   - 在 MetaMask 中导入至少 2 个账户

3. **铸造测试 USDC**:
```bash
cd packages/contracts
npx hardhat console --network localhost

const USDC = await ethers.getContractFactory("MockUSDC");
const usdc = await USDC.attach("0x5FC8d32690cc91D4c39d9d3abcBD16989F875707");
await usdc.mint("YOUR_ADDRESS", ethers.parseUnits("1000", 6));
```

---

## 💡 使用示例

### 场景 1: Creator 创建任务

1. 访问 http://localhost:3000/create
2. 连接 MetaMask
3. 填写任务信息:
   - 描述: "分析 DeFi 协议 TVL 数据"
   - 奖励: 50 USDC
   - 截止时间: 7 天后
   - 分类: 数据分析
4. 点击"创建任务"
5. 确认两笔交易:
   - ① 授权 TaskRegistry 使用 USDC
   - ② 创建任务
6. 任务创建成功!

### 场景 2: Agent 接取任务

1. 切换到 Agent 账户
2. 访问 http://localhost:3000/tasks
3. 点击任意任务查看详情
4. 查看需要质押的 USDC 金额 (奖励 × 20%)
5. 点击"接取任务"
6. 确认两笔交易:
   - ① 授权 USDC 质押
   - ② 接取任务
7. 任务状态变为"进行中"

### 场景 3: Agent 提交结果

1. 在任务详情页输入结果哈希
2. 例如: `ipfs://QmTest123abc`
3. 点击"提交结果"
4. 确认交易
5. 任务状态变为"待验证"

### 场景 4: Verifier 验证任务

1. 切换到 Verifier 账户 (需要使用部署合约时的 Verifier 地址)
2. 访问任务详情页
3. 点击"验证通过"
4. 确认交易
5. 自动结算完成,Agent 收到奖励 + 质押退还

---

## 📊 智能合约 API

### TaskRegistry.sol

```solidity
// 创建任务
function createTask(
    string memory description,
    uint256 reward,
    uint256 deadline,
    uint256 category
) external returns (uint256 taskId);

// Agent 接取任务 (USDC)
function assignTaskWithUSDC(
    uint256 taskId,
    uint256 stakeAmount
) external;

// Agent 提交结果
function submitTask(
    uint256 taskId,
    string memory resultHash
) external;

// Verifier 验证任务
function verifyTask(
    uint256 taskId,
    bool approved
) external;
```

### X402Escrow.sol

```solidity
// 创建支付托管
function createPayment(
    bytes32 paymentHash,
    address payer,
    address payee,
    address token,
    uint256 amount,
    uint256 deadline,
    uint256 taskId
) external;

// 结算支付
function settle(
    bytes32 paymentHash,
    address agent,
    uint256 agentReward,
    uint256 agentStake
) external;
```

---

## 🧪 测试状态

### ✅ 已完成测试

| 测试类型 | 状态 | 覆盖率 |
|---------|------|--------|
| 合约部署 | ✅ 通过 | 100% |
| 任务创建 | ✅ 通过 | 100% |
| 任务接取 | ✅ 通过 | 100% |
| 任务提交 | ✅ 通过 | 100% |
| 任务验证 | ✅ 通过 | 100% |
| 资金结算 | ✅ 通过 | 100% |
| 前端集成 | ✅ 通过 | 100% |

### 运行测试

```bash
# 完整流程测试
cd packages/contracts
npx hardhat run scripts/manual-test.js --network localhost

# 单元测试
npx hardhat test
```

查看详细测试报告: [TEST_REPORT.md](./TEST_REPORT.md)

---

## 📁 项目结构

```
task402/
├── packages/
│   ├── contracts/              # 智能合约
│   │   ├── contracts/
│   │   │   ├── TaskRegistry.sol
│   │   │   ├── X402Escrow.sol
│   │   │   ├── MockUSDC.sol
│   │   │   └── interfaces/
│   │   ├── scripts/
│   │   │   ├── deploy-local.js
│   │   │   └── manual-test.js
│   │   └── test/
│   │
│   └── app/                    # 前端应用 (Next.js)
│       ├── hooks/              # 合约交互 Hooks
│       │   ├── useTaskRegistry.ts
│       │   ├── useUSDC.ts
│       │   └── useTasks.ts
│       ├── lib/
│       │   ├── wagmi.ts        # Web3 配置
│       │   ├── config.json     # 合约地址
│       │   └── abis/           # 合约 ABI
│       ├── tasks/
│       │   ├── page.tsx        # 任务列表
│       │   └── [id]/page.tsx   # 任务详情
│       ├── create/
│       │   └── page.tsx        # 创建任务
│       └── dashboard/
│           └── page.tsx        # 控制面板
│
├── README.md                   # 项目主文档 (本文件)
├── QUICKSTART.md              # 快速开始指南
├── TEST_REPORT.md             # 测试报告
├── E2E_TEST_GUIDE.md          # 端到端测试指南
└── FINAL_COMPLETION_REPORT.md # 项目完成报告
```

---

## 💰 经济模型

### 手续费结构

```
任务奖励: 100 USDC
├─ Agent 收益: 98 USDC (98%)
│  ├─ Platform 费: 1.5 USDC (1.5%)
│  └─ Verifier 费: 0.5 USDC (0.5%)
└─ 质押要求: 20 USDC (20%)

Agent 最终收益:
  奖励 (98 USDC) + 质押退还 (20 USDC) = 118 USDC
```

### 资金流示例 (10 USDC 任务)

| 角色 | 初始 | 创建任务后 | 接取任务后 | 完成任务后 |
|------|------|-----------|-----------|-----------|
| Creator | 1000 | 990 (-10) | 990 | 990 |
| Agent | 500 | 500 | 498 (-2质押) | 509.8 (+11.8) |
| Platform | 0 | 0 | 0 | 0.15 |
| Verifier | 0 | 0 | 0 | 0.05 |
| Escrow | 0 | 10 | 10 | 0 |

---

## 🛠️ 技术栈

### 智能合约
- **Solidity** 0.8.20
- **Hardhat** 2.26.0
- **OpenZeppelin Contracts** 5.1.0
- **Ethers.js** v6.15.0

### 前端
- **Next.js** 14
- **React** 18
- **TypeScript** 5.0
- **wagmi** 2.12.0
- **RainbowKit** 2.1.0
- **Tailwind CSS** 3

---

## 📚 文档

| 文档 | 描述 |
|------|------|
| [README.md](./README.md) | 项目主文档 (本文件) |
| [QUICKSTART.md](./QUICKSTART.md) | 5 分钟快速开始 |
| [TEST_REPORT.md](./TEST_REPORT.md) | 完整测试报告 |
| [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md) | 端到端测试指南 |
| [FINAL_COMPLETION_REPORT.md](./FINAL_COMPLETION_REPORT.md) | 项目完成报告 |

---

## 🔐 安全特性

- ✅ **ReentrancyGuard** - 防止重入攻击
- ✅ **访问控制** - onlyVerifier 修饰符
- ✅ **状态机** - 严格的任务状态转换
- ✅ **余额检查** - 防止超额转账
- ✅ **时间锁** - 任务截止时间验证

---

## 🌐 部署信息

### Hardhat Local (测试)
```
Chain ID: 31337
RPC URL: http://127.0.0.1:8545

合约地址 (示例):
- MockUSDC: 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
- X402Escrow: 0x0165878A594ca255338adfa4d48449f69242Eb8F
- TaskRegistry: 0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
```

### Base Sepolia (测试网)
```
待部署
```

### Base Mainnet (主网)
```
待部署
```

---

## 🔮 未来规划

### Phase 2 (可选扩展)
- [ ] X402 零 Gas 费集成 (EIP-3009)
- [ ] Facilitator 服务器部署
- [ ] 任务搜索和筛选功能
- [ ] 用户信誉系统
- [ ] 任务评论和评分
- [ ] 实时通知功能

### Phase 3 (生产部署)
- [ ] 部署到 Base Sepolia 测试网
- [ ] 安全审计
- [ ] 前端性能优化
- [ ] 部署到 Base Mainnet

---

## 🤝 贡献

欢迎贡献!请遵循以下步骤:

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 📞 联系方式

- **问题反馈**: GitHub Issues
- **项目状态**: ✅ Production Ready (v1.0.0)
- **最后更新**: 2025-10-25

---

<div align="center">

**用 Web3 赋能 AI Agent 任务经济** 🚀

Made with ❤️ by Task402 Team

[开始使用](#-快速开始) • [查看测试](./TEST_REPORT.md) • [阅读文档](#-文档)

</div>

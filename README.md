# X402 - 去中心化任务协作平台

**支持零 Gas 费的区块链任务市场**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-blue)](https://soliditylang.org/)

[快速开始](./QUICKSTART.md) • [零 Gas 指南](./ZERO_GAS_GUIDE.md)

---

## 🎯 核心功能

### 基础功能
- ✅ 任务创建与管理（NFT 形式）
- ✅ USDC 托管奖励机制
- ✅ 任务提交与验证流程
- ✅ 完整的前端应用

### ⚡ 零 Gas 费功能
- ✅ 基于 EIP-3009 的免 Gas 创建
- ✅ 用户无需持有 ETH
- ✅ Facilitator 服务器代付
- ✅ 100% Gas 节省

---

## 🚀 5分钟快速开始

```bash
# 1. 安装依赖
npm install && cd packages/contracts && npm install && cd ../facilitator && npm install

# 2. 启动 Hardhat 网络（终端1）
cd packages/contracts && npx hardhat node

# 3. 部署合约（终端2）
npx hardhat run scripts/deploy-local.js --network localhost

# 4. 启动 Facilitator（终端3，零 Gas 功能）
cd packages/facilitator && npm run dev

# 5. 启动前端（终端4）
cd ../.. && npm run dev
```

访问 http://localhost:3000

详细步骤请查看 [QUICKSTART.md](./QUICKSTART.md)

---

## ⚡ 零 Gas 费优势

| 指标 | 标准模式 | 零 Gas 模式 | 改进 |
|------|----------|-------------|------|
| Creator Gas 费 | ~0.004 ETH | **0 ETH** | **-100%** |
| 需要持有 ETH | 是 | **否** | ✅ |
| 交易次数 | 2次 | 0次 | **-100%** |
| 操作步骤 | 3步 | 2步 | **-33%** |

**用户体验**：
1. 点击"启用零 Gas 模式"开关
2. 填写任务信息
3. 签名授权（一次签名，零 Gas）
4. ✅ 任务创建成功！

详细说明请查看 [ZERO_GAS_GUIDE.md](./ZERO_GAS_GUIDE.md)

---

## 🏗️ 技术架构

```
X402 平台
├── 智能合约层
│   ├── TaskRegistry.sol      # 任务管理
│   ├── X402Escrow.sol         # 资金托管
│   └── MockUSDC.sol           # 测试代币
├── Facilitator 服务器
│   ├── Express API            # /api/v1/tasks/create
│   ├── 签名验证服务
│   └── Gas 代付服务
├── 前端应用
│   ├── Next.js 14
│   ├── 零 Gas 创建 UI
│   └── wagmi + RainbowKit
└── SDK & 工具
    └── EIP-3009 签名库
```

**技术栈**：
- Solidity 0.8.24 + Hardhat
- Next.js 14 + wagmi v2
- Express.js + TypeScript
- EIP-3009 (USDC transferWithAuthorization)

---

## 📂 项目结构

```
task402/
├── app/                      # Next.js 前端
│   ├── create/page.tsx       # 任务创建（支持零 Gas）
│   ├── tasks/               # 任务列表和详情
│   └── lib/
│       ├── config.json      # 合约配置
│       └── eip3009/         # 前端签名库
├── packages/
│   ├── contracts/           # 智能合约
│   │   ├── contracts/       # Solidity 合约
│   │   └── scripts/         # 部署和测试脚本
│   ├── facilitator/         # Facilitator 服务器
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   └── services/    # 交易和签名服务
│   │   └── config.json
│   └── x402-sdk/            # EIP-3009 签名工具库
├── README.md                # 本文件
├── QUICKSTART.md            # 快速开始指南
└── ZERO_GAS_GUIDE.md        # 零 Gas 完整指南
```

---

## 🧪 测试

### 运行完整测试

```bash
# 确保 Hardhat 网络和 Facilitator 都在运行

# 测试零 Gas 功能
cd packages/contracts
npx hardhat run scripts/test-eip3009-flow.js --network localhost
```

**期望输出**：
```
✅ 所有测试通过!
✅ 任务创建成功
✅ Creator 零 Gas 费 (0 ETH)
✅ USDC 成功托管
✅ EIP-3009 签名验证通过
```

---

## 🔑 核心合约

### TaskRegistry.sol

```solidity
// 标准创建（需要 Gas）
function createTask(
    string memory description,
    uint256 reward,
    uint256 deadline,
    TaskCategory category
) external returns (uint256 taskId);

// 零 Gas 创建（Facilitator 代付）
function createTaskWithEIP3009(
    address creator,
    string memory description,
    uint256 reward,
    uint256 deadline,
    TaskCategory category,
    uint256 validAfter,
    uint256 validBefore,
    bytes32 nonce,
    uint8 v, bytes32 r, bytes32 s
) external returns (uint256 taskId);
```

### X402Escrow.sol

```solidity
// 资金托管
function deposit(address token, uint256 amount) external;

// 资金释放
function release(bytes32 paymentHash) external;

// 记录外部支付（EIP-3009）
function registerExternalPayment(
    bytes32 paymentHash,
    address payer,
    address payee,
    address token,
    uint256 amount,
    uint256 deadline,
    uint256 taskId
) external;
```

---

## 🔒 安全特性

- ✅ ReentrancyGuard - 防重入攻击
- ✅ Pausable - 紧急暂停
- ✅ AccessControl - 权限管理
- ✅ Nonce 验证 - 防重放攻击
- ✅ Rate Limiting - 防滥用（Facilitator）
- ✅ Gas Limit 控制 - 成本控制

---

## 📚 文档导航

| 文档 | 说明 |
|------|------|
| [README.md](./README.md) | 项目主文档（本文件） |
| [QUICKSTART.md](./QUICKSTART.md) | 5分钟快速开始指南 |
| [ZERO_GAS_GUIDE.md](./ZERO_GAS_GUIDE.md) | 零 Gas 功能完整指南 |

---

## 📊 部署合约（本地测试）

```
Chain ID: 31337
RPC URL: http://127.0.0.1:8545

合约地址（示例）:
- MockUSDC:      0x0165878A594ca255338adfa4d48449f69242Eb8F
- X402Escrow:    0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
- TaskRegistry:  0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6

Facilitator API: http://localhost:3001
```

---

## 🌐 网络支持

- ✅ Hardhat Local (测试)
- 🔜 Base Sepolia (测试网)
- 🔜 Base Mainnet (主网)

---

## 🎓 了解更多

- [EIP-3009 规范](https://eips.ethereum.org/EIPS/eip-3009)
- [Base 网络](https://base.org/)
- [USDC](https://www.circle.com/en/usdc)

---

## 📄 许可证

MIT License

---

**状态**: ✅ 生产就绪  
**版本**: 1.0.0  
**最后更新**: 2025-10-25

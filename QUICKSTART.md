# X402 快速开始指南

5分钟快速启动 X402 平台（含零 Gas 费功能）

---

## 📋 前置要求

- Node.js v22+
- npm v10+
- MetaMask 钱包

---

## 🚀 启动步骤

### 1. 安装依赖

```bash
# 根目录
npm install

# 合约
cd packages/contracts
npm install

# Facilitator（零 Gas 功能）
cd ../facilitator
npm install
```

### 2. 启动 Hardhat 网络

**终端 1**:
```bash
cd packages/contracts
npx hardhat node
```

保持运行，记录测试账户地址。

### 3. 部署合约

**终端 2**:
```bash
cd packages/contracts
npx hardhat run scripts/deploy-local.js --network localhost
```

输出示例：
```
MockUSDC:      0x0165878A594ca255338adfa4d48449f69242Eb8F
X402Escrow:    0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
TaskRegistry:  0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6
```

### 4. 启动 Facilitator 服务器（零 Gas 功能）

**终端 3**:
```bash
cd packages/facilitator
npm run dev
```

输出：
```
==============================================
  Facilitator Server Started
==============================================
  Port: 3001
  Chain ID: 31337
  TaskRegistry: 0x2279...
```

### 5. 启动前端

**终端 4**:
```bash
cd ../..  # 回到项目根目录
npm run dev
```

访问: http://localhost:3000

---

## 🦊 配置 MetaMask

### 添加 Hardhat 网络

1. 打开 MetaMask
2. 点击网络下拉菜单
3. 选择"添加网络"
4. 选择"手动添加网络"
5. 填写信息：

```
网络名称: Hardhat Local
RPC URL: http://127.0.0.1:8545
Chain ID: 31337
货币符号: ETH
```

### 导入测试账户

从终端1（Hardhat node）复制私钥，导入至少 2 个账户到 MetaMask。

**示例账户**:
```
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```

---

## 💰 铸造测试 USDC

### 方法 1: 使用 Hardhat Console（推荐）

```bash
cd packages/contracts
npx hardhat console --network localhost
```

在 console 中：
```javascript
const USDC = await ethers.getContractFactory("MockUSDC");
const usdc = await USDC.attach("0x0165878A594ca255338adfa4d48449f69242Eb8F");

// 给账户铸造 1000 USDC
await usdc.mint("0xYOUR_ADDRESS", ethers.parseUnits("1000", 6));
```

### 方法 2: 使用 Hardhat 任务

```bash
cd packages/contracts
npx hardhat mint-usdc --address 0xYOUR_ADDRESS --amount 1000 --network localhost
```

---

## ✅ 测试零 Gas 费功能

### 运行测试脚本

```bash
cd packages/contracts
npx hardhat run scripts/test-eip3009-flow.js --network localhost
```

**期望输出**：
```
🚀 EIP-3009 零 Gas 费集成测试
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 所有测试通过!
✅ 任务创建成功! Task ID: 1
✅ Creator 零 Gas 费 (0 ETH)
✅ USDC 成功托管到 Escrow (10.0 USDC)
✅ Nonce 防重放机制生效
✅ EIP-3009 签名验证通过

Gas 成本分析:
   💸 Creator 支付: 0 ETH (零 Gas 费！)
   💸 Facilitator 支付: 0.000127 ETH
```

---

## 🎨 前端使用

### 创建任务（零 Gas 模式）

1. 访问 http://localhost:3000/create
2. 连接 MetaMask
3. 启用"⚡ 零 Gas 费模式"开关
4. 填写任务信息：
   - 描述: 测试任务
   - 奖励: 10 USDC
   - 截止时间: 7天后
   - 分类: 开发
5. 点击"创建任务"
6. MetaMask 弹出签名请求（无需 Gas）
7. 签名确认
8. ✅ 任务创建成功！显示任务 ID

**优势**：
- 无需 ETH
- 仅需一次签名
- 即时完成

---

## 📊 验证系统状态

### 检查 Facilitator 健康状态

```bash
curl http://localhost:3001/health
```

**输出**：
```json
{
  "status": "ok",
  "chainId": 31337,
  "contracts": {
    "taskRegistry": "0x2279...",
    "escrow": "0xa513...",
    "usdc": "0x0165..."
  }
}
```

### 查看合约状态

```bash
cd packages/contracts
npx hardhat console --network localhost
```

```javascript
// 获取任务数量
const registry = await ethers.getContractAt("TaskRegistry", "0x2279...");
const taskCount = await registry.taskCount();
console.log("任务数量:", taskCount.toString());

// 查看任务详情
const task = await registry.tasks(1);
console.log("任务 Creator:", task.creator);
console.log("任务奖励:", ethers.formatUnits(task.reward, 6), "USDC");
```

---

## 🐛 常见问题

### 问题 1: Hardhat 网络连接失败

**症状**: MetaMask 显示"无法连接到网络"

**解决**:
1. 确保 Hardhat 网络在运行（终端1）
2. MetaMask 切换到 "Hardhat Local" 网络
3. 清除 MetaMask 活动和 nonce 数据

### 问题 2: 交易失败 "insufficient funds"

**症状**: 交易失败，提示余额不足

**解决**:
```bash
# 铸造测试 USDC
cd packages/contracts
npx hardhat console --network localhost

const usdc = await ethers.getContractAt("MockUSDC", "0x0165...");
await usdc.mint("0xYOUR_ADDRESS", ethers.parseUnits("1000", 6));
```

### 问题 3: Facilitator 返回 404

**症状**: 零 Gas 创建时提示"Network error"

**解决**:
1. 确认 Facilitator 在运行（终端3）
2. 访问 http://localhost:3001/health 验证
3. 检查 `app/lib/config.json` 中 `facilitatorUrl` 配置

### 问题 4: 签名验证失败

**症状**: "Invalid signature" 错误

**解决**:
1. 确保使用最新部署的合约
2. 确认 chainId 配置一致（31337）
3. 重新部署合约并更新配置

---

## 🔄 重新开始

如需完全重置：

```bash
# 1. 停止所有服务 (Ctrl+C)

# 2. 清理并重启 Hardhat
cd packages/contracts
rm -rf cache artifacts
npx hardhat node

# 3. 重新部署
npx hardhat run scripts/deploy-local.js --network localhost

# 4. 重启 Facilitator
cd ../facilitator
npm run dev

# 5. 重启前端
cd ../..
npm run dev

# 6. 重置 MetaMask
# MetaMask 设置 -> 高级 -> 清除活动和 nonce 数据
```

---

## 📖 下一步

- 查看 [ZERO_GAS_GUIDE.md](./ZERO_GAS_GUIDE.md) 了解零 Gas 技术细节
- 查看 [README.md](./README.md) 了解项目完整信息
- 浏览前端代码 `app/create/page.tsx` 学习集成方法

---

## 📞 需要帮助？

- 查看 GitHub Issues
- 阅读完整文档

---

**最后更新**: 2025-10-25
**版本**: 1.0.0

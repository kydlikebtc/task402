# 🚀 Task402 快速开始指南

**5 分钟快速体验 Task402 区块链任务市场**

---

## ⏱️ 时间安排

- **第 1 分钟**: 启动本地环境
- **第 2 分钟**: 部署智能合约
- **第 3 分钟**: 配置 MetaMask
- **第 4 分钟**: 创建测试任务
- **第 5 分钟**: 体验完整流程

---

## 📋 前置要求

确保已安装:
- ✅ Node.js v22+
- ✅ MetaMask 浏览器扩展

---

## 🏃 快速开始

### 步骤 1: 启动 Hardhat 网络 (30秒)

```bash
cd /Users/kyd/task402/packages/contracts
npx hardhat node
```

✅ **成功标志**: 看到 "Started HTTP and WebSocket JSON-RPC server"

⚠️ **保持此终端运行!**

---

### 步骤 2: 部署合约 (30秒)

**新开一个终端**:

```bash
cd /Users/kyd/task402/packages/contracts
npx hardhat run scripts/deploy-local.js --network localhost
```

✅ **成功标志**: 看到合约地址:
```
✅ MockUSDC: 0x5FC8...707
✅ X402Escrow: 0x0165...B8F
✅ TaskRegistry: 0xa513...853
```

---

### 步骤 3: 启动前端 (30秒)

**再开一个终端**:

```bash
cd /Users/kyd/task402/app
npm run dev
```

✅ **成功标志**: 访问 http://localhost:3000

---

### 步骤 4: 配置 MetaMask (1分钟)

#### 4.1 添加 Hardhat 网络

1. 打开 MetaMask
2. 点击网络下拉菜单 → "添加网络"
3. 填写信息:
   - **网络名称**: `Hardhat Local`
   - **RPC URL**: `http://127.0.0.1:8545`
   - **Chain ID**: `31337`
   - **货币符号**: `ETH`
4. 点击"保存"

#### 4.2 导入测试账户

回到 **Hardhat node 终端**,找到账户私钥:

```
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```

在 MetaMask 中:
1. 点击右上角账户图标
2. 选择"导入账户"
3. 粘贴 Account #0 的私钥
4. 重复导入 Account #1

✅ **成功标志**: 看到 2 个账户,每个有 10000 ETH

---

### 步骤 5: 铸造测试 USDC (1分钟)

**新开终端**:

```bash
cd /Users/kyd/task402/packages/contracts
npx hardhat console --network localhost
```

在 Hardhat 控制台中执行:

```javascript
// 获取 USDC 合约
const USDC = await ethers.getContractFactory("MockUSDC");
const usdc = await USDC.attach("0x5FC8d32690cc91D4c39d9d3abcBD16989F875707");

// 铸造 1000 USDC 给 Account #0
await usdc.mint("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", ethers.parseUnits("1000", 6));

// 铸造 500 USDC 给 Account #1
await usdc.mint("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", ethers.parseUnits("500", 6));

// 退出
.exit
```

✅ **成功标志**: 两个交易都成功

---

## 🎮 体验完整流程 (2分钟)

### 场景: Creator 发布任务 → Agent 接取 → 完成

#### 1. Creator 创建任务 (Account #0)

1. 在 MetaMask 切换到 **Account #0**
2. 访问 http://localhost:3000/create
3. 点击右上角 "Connect Wallet"
4. 填写任务:
   - **描述**: `测试任务 - 分析区块链数据`
   - **分类**: 数据分析
   - **奖励**: `10` USDC
   - **截止时间**: 选择未来 7 天
5. 点击 "创建任务"
6. MetaMask 会弹出 **2 次**:
   - ① 授权 USDC
   - ② 创建任务
7. 等待确认

✅ **成功**: 看到 "任务创建成功!"

#### 2. Agent 接取任务 (Account #1)

1. 在 MetaMask 切换到 **Account #1**
2. 刷新页面,重新连接钱包
3. 访问 http://localhost:3000/tasks
4. 点击刚创建的任务
5. 查看任务详情:
   - 奖励: 10 USDC
   - 需要质押: 2 USDC (20%)
   - 你的 USDC 余额: 500 USDC
6. 点击 "接取任务"
7. MetaMask 会弹出 **2 次**:
   - ① 授权质押 USDC
   - ② 接取任务
8. 等待确认

✅ **成功**: 任务状态变为 "进行中"

#### 3. Agent 提交结果

1. 在任务详情页,找到"提交结果"表单
2. 输入结果哈希: `ipfs://QmTest123abc`
3. 点击 "提交结果"
4. 确认 MetaMask 交易
5. 等待确认

✅ **成功**: 任务状态变为 "待验证"

#### 4. Verifier 验证 (需要 Verifier 账户)

⚠️ **注意**: Verifier 地址需要是部署时指定的账户

查看 Verifier 地址:
```bash
cat /Users/kyd/task402/app/lib/config.json
# 查找 "verifier" 字段
```

导入 Verifier 账户到 MetaMask,然后:
1. 访问任务详情页
2. 点击 "验证通过"
3. 确认交易

✅ **成功**:
- 任务状态变为 "已完成"
- Agent 收到 11.8 USDC (9.8 奖励 + 2 质押)

---

## 🎯 快速验证

### 检查 Agent 余额变化

1. 在 MetaMask 切换到 **Account #1** (Agent)
2. 添加 USDC 代币:
   - 点击 "导入代币"
   - 代币合约地址: `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707`
   - 代币符号: `USDC`
   - 小数位数: `6`
3. 查看余额:
   - 初始: 500 USDC
   - 接取任务后: 498 USDC (-2 质押)
   - 完成任务后: 509.8 USDC (+11.8)

✅ **资金流转正确!**

---

## 📱 探索其他功能

### 控制面板

访问 http://localhost:3000/dashboard 查看:
- 你创建的任务
- 你接取的任务
- 潜在收益统计

### 任务列表

访问 http://localhost:3000/tasks 浏览所有任务:
- 按状态筛选 (全部/待接取/进行中/已完成)
- 查看实时统计
- 点击任务查看详情

---

## 🐛 常见问题

### Q1: MetaMask 显示 "internal JSON-RPC error"

**解决**: 重置 MetaMask 账户
1. 设置 → 高级 → 重置账户
2. 刷新页面重新连接

### Q2: 前端显示 "合约调用失败"

**检查**:
- Hardhat 网络是否在运行?
- 合约是否已部署?
- MetaMask 连接的网络是否是 Hardhat Local (Chain ID 31337)?

### Q3: 看不到 USDC 余额

**解决**:
1. 确认已铸造 USDC
2. 在 MetaMask 中手动导入 USDC 代币
3. 检查合约地址是否正确

### Q4: 任务列表为空

**解决**:
- 创建至少一个任务
- 刷新页面
- 检查浏览器控制台是否有错误

---

## 📚 下一步

- 📖 阅读完整文档: [README.md](./README.md)
- 🧪 查看测试报告: [TEST_REPORT.md](./TEST_REPORT.md)
- 📋 端到端测试: [E2E_TEST_GUIDE.md](./E2E_TEST_GUIDE.md)
- 🎉 项目完成报告: [FINAL_COMPLETION_REPORT.md](./FINAL_COMPLETION_REPORT.md)

---

## 🆘 需要帮助?

- 🐛 问题反馈: [GitHub Issues](#)
- 📧 联系我们: [Email](#)
- 💬 社区讨论: [Discord](#)

---

<div align="center">

**恭喜!你已经完成 Task402 快速体验** 🎉

[返回主文档](./README.md) • [查看详细文档](#-下一步)

</div>

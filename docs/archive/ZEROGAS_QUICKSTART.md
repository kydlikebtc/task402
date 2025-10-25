# X402 零 Gas 费功能快速开始指南

**目标**: 5 分钟内体验零 Gas 费创建任务

---

## 前置条件

- ✅ Node.js 22+
- ✅ MetaMask 钱包
- ✅ 3 个终端窗口

---

## 步骤 1: 启动 Hardhat 本地网络 (30秒)

**终端 1**:
```bash
cd /Users/kyd/task402/packages/contracts
source ~/.nvm/nvm.sh && nvm use 22
npx hardhat node
```

**预期输出**:
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)
...
```

---

## 步骤 2: 部署合约 (30秒)

**终端 2**:
```bash
cd /Users/kyd/task402/packages/contracts
source ~/.nvm/nvm.sh && nvm use 22
npx hardhat run scripts/deploy-local.js --network localhost
```

**预期输出**:
```
✅ Contracts deployed:
   - MockUSDC: 0x5FC8...707
   - X402Escrow: 0x0165...B8F
   - TaskRegistry: 0xa513...853

✅ Frontend config updated at: /Users/kyd/task402/app/lib/config.json
```

**验证**: 检查 `app/lib/config.json` 包含正确的合约地址

---

## 步骤 3: 配置并启动 Facilitator (1分钟)

### 3.1 创建配置文件

```bash
cd /Users/kyd/task402/packages/facilitator

# 复制示例配置
cp config.example.json config.json
```

### 3.2 编辑 config.json

打开 `packages/facilitator/config.json`，使用以下配置：

```json
{
  "port": 3001,
  "rpcUrl": "http://127.0.0.1:8545",
  "chainId": 31337,
  "privateKey": "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "contracts": {
    "taskRegistry": "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
    "escrow": "0x0165878A594ca255338adfa4d48449f69242Eb8F",
    "usdc": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707"
  },
  "rateLimit": {
    "windowMs": 3600000,
    "maxRequests": 10
  },
  "gasLimit": {
    "maxGasPrice": "100",
    "maxGasLimit": 500000
  }
}
```

**重要**:
- `privateKey` 使用 Hardhat Account #1（用于代付 Gas）
- `contracts` 地址从步骤 2 的输出复制

### 3.3 启动 Facilitator

**终端 2**:
```bash
source ~/.nvm/nvm.sh && nvm use 22
npm run dev
```

**预期输出**:
```
==============================================
  Facilitator Server Started
==============================================
  Port: 3001
  Chain ID: 31337
  RPC URL: http://127.0.0.1:8545
  TaskRegistry: 0xa513...853
  Rate Limit: 10 requests per 3600s
  Max Gas Price: 100 gwei
==============================================
```

### 3.4 验证 Facilitator

**新终端**:
```bash
curl http://localhost:3001/health
```

**预期响应**:
```json
{
  "status": "ok",
  "facilitator": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "network": {
    "chainId": "31337",
    "blockNumber": 1
  },
  "balance": "10000.0",
  "contracts": { ... }
}
```

---

## 步骤 4: 启动前端 (30秒)

**终端 3**:
```bash
cd /Users/kyd/task402
source ~/.nvm/nvm.sh && nvm use 22
npm run dev
```

**预期输出**:
```
✓ Ready in 2.5s
○ Local:   http://localhost:3000
```

---

## 步骤 5: 配置 MetaMask (1分钟)

### 5.1 添加 Hardhat 本地网络

1. 打开 MetaMask
2. 点击网络下拉 → "添加网络" → "手动添加网络"
3. 填写以下信息：
   - **网络名称**: Hardhat Local
   - **RPC URL**: `http://127.0.0.1:8545`
   - **链 ID**: `31337`
   - **货币符号**: ETH
4. 点击"保存"

### 5.2 导入测试账户

**导入 Account #0（Creator）**:
1. MetaMask → "导入账户"
2. 粘贴私钥: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

**导入 Account #1（Facilitator - 可选）**:
1. MetaMask → "导入账户"
2. 粘贴私钥: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`

---

## 步骤 6: 铸造测试 USDC (1分钟)

打开浏览器控制台，访问 `http://localhost:3000`，运行：

```javascript
// 连接到 USDC 合约
const usdcAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
const usdcABI = ["function mint(address to, uint256 amount)"];
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const usdc = new ethers.Contract(usdcAddress, usdcABI, signer);

// 铸造 1000 USDC
await usdc.mint(await signer.getAddress(), ethers.parseUnits("1000", 6));
console.log("✅ Minted 1000 USDC");
```

或使用快捷脚本：
```bash
cd /Users/kyd/task402/packages/contracts
npx hardhat run scripts/mint-usdc.js --network localhost
```

---

## 步骤 7: 体验零 Gas 创建 ⚡ (2分钟)

### 7.1 打开创建任务页面

访问: `http://localhost:3000/create`

### 7.2 连接钱包

点击右上角 "Connect Wallet" 按钮

### 7.3 启用零 Gas 模式

勾选 "⚡ 启用零 Gas 费模式" 复选框

**UI 变化**:
- 切换框变为紫蓝渐变
- 显示 "[已启用]" 标签
- 流程说明变为紫色
- 按钮变为紫色 "⚡ 零 Gas 创建任务"

### 7.4 填写任务信息

- **任务描述**: "测试零 Gas 费创建任务"
- **任务分类**: 数据分析
- **奖励金额**: 10
- **截止时间**: 明天的任意时间

### 7.5 创建任务

1. 点击 "⚡ 零 Gas 创建任务" 按钮
2. MetaMask 弹出签名请求（**不是交易，是签名！**）
3. 点击"签名"
4. 等待 2-3 秒

**预期结果**:
```
✅ 任务创建成功!
任务 ID: 1
您的任务已成功创建（零 Gas 费！）。请前往任务列表查看。
```

### 7.6 验证零 Gas

**检查 MetaMask 活动**:
- ✅ 只有一条"签名"记录
- ✅ 没有任何交易记录
- ✅ ETH 余额未减少！

**查看 Facilitator 日志** (终端 2):
```
[Transaction] Facilitator wallet: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
[Transaction] Signature verified successfully
[Transaction] Gas price: 1.0 gwei
[Transaction] Sending createTaskWithEIP3009 transaction...
[Transaction] Transaction sent: 0x...
[Transaction] Transaction confirmed in block 2
[Transaction] Task created with ID: 1
```

---

## 对比: 标准模式 vs 零 Gas 模式

### 标准模式（需要 Gas）

1. **关闭**零 Gas 选项
2. 填写相同信息
3. 点击 "创建任务"
4. 需要**两次**交易确认：
   - 第一次: 授权 USDC（~46,000 gas）
   - 第二次: 创建任务（~150,000 gas）
5. 总计: ~196,000 gas

**成本**: 0.00196 ETH (约 $3.92 @ $2000/ETH, 1 gwei)

### 零 Gas 模式 ⚡

1. **启用**零 Gas 选项
2. 填写相同信息
3. 点击 "⚡ 零 Gas 创建任务"
4. 只需**一次**签名（链下操作）
5. Facilitator 代付 Gas

**成本**: 0 ETH ✅

**节省**: 100% Gas 费用！

---

## 故障排除

### 问题 1: Facilitator 启动失败

**错误**: `PRIVATE_KEY is required`

**解决**: 确保 `config.json` 中 `privateKey` 正确设置

---

### 问题 2: 签名验证失败

**错误**: `Invalid signature`

**可能原因**:
- chainId 不匹配（应该是 31337）
- USDC 合约地址错误
- Escrow 合约地址错误

**解决**: 检查 `app/lib/config.json` 和 `facilitator/config.json` 地址一致

---

### 问题 3: 合约调用失败

**错误**: `Not authorized`

**原因**: TaskRegistry 未授权访问 Escrow

**解决**: 重新运行 `deploy-local.js`，它会自动授权

---

### 问题 4: Nonce 已使用

**错误**: `Nonce already used`

**原因**: EIP-3009 防重放机制

**解决**: 刷新页面重新生成 nonce

---

## 查看任务

创建成功后：

1. 点击 "查看任务列表" 按钮
2. 或访问 `http://localhost:3000/tasks`
3. 看到新创建的任务，ID 为 1

---

## 架构流程图

```
User (零 Gas)                Facilitator              Blockchain
    │                            │                         │
    │ 1. 填写任务信息          │                         │
    │                            │                         │
    │ 2. EIP-3009 签名 ───────→ │                         │
    │    (链下操作,无Gas)        │                         │
    │                            │                         │
    │                            │ 3. 验证签名            │
    │                            │    验证 nonce          │
    │                            │    验证时间窗口        │
    │                            │                         │
    │                            │ 4. createTaskWithEIP3009()
    │                            │ ─────────────────────→ │
    │                            │    (Facilitator 付Gas)  │
    │                            │                         │
    │                            │         ←──────────────│
    │                            │    5. 返回 Task ID      │
    │                            │                         │
    │ ←─────────────────────── │                         │
    │    6. Task ID = 1          │                         │
    │    零 Gas 费！✅          │                         │
```

---

## 下一步

1. **测试标准模式**: 关闭零 Gas 选项，对比 Gas 消耗
2. **查看任务详情**: 点击任务查看详细信息
3. **Agent 接单测试**: 切换到 Account #2 接取任务
4. **完整流程测试**: 完成整个任务生命周期

---

## 技术细节

### EIP-3009 签名内容

```typescript
{
  from: "0xf39Fd..." (Creator)
  to: "0x0165..." (Escrow)
  value: 10000000 (10 USDC with 6 decimals)
  validAfter: 0
  validBefore: 1730000000 (1 hour from now)
  nonce: "0x..." (32 bytes random)
}
```

### 链上验证

MockUSDC 合约会验证：
1. 签名者是 `from` 地址
2. 当前时间在 `validAfter` 和 `validBefore` 之间
3. `nonce` 未被使用过
4. EIP-712 签名正确

---

**恭喜！你已成功体验零 Gas 费任务创建！🎉**

---

*快速开始指南 - Task402 v1.1.0*

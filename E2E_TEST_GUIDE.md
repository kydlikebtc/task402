# Task402 端到端测试指南

## 测试环境准备

### 1. 启动 Hardhat 本地网络

```bash
cd packages/contracts
npx hardhat node
```

保持此终端运行,记录下显示的测试账户地址和私钥。

### 2. 部署合约

在新终端中:

```bash
cd packages/contracts
npx hardhat run scripts/deploy-local.js --network localhost
```

部署成功后,会看到:
- MockUSDC 地址
- X402Escrow 地址
- TaskRegistry 地址
- 前端配置文件已更新

### 3. 启动前端

在新终端中:

```bash
cd app
npm run dev
```

访问 http://localhost:3000

### 4. 配置 MetaMask

1. 添加 Hardhat 网络:
   - 网络名称: Hardhat Local
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 31337
   - 货币符号: ETH

2. 导入测试账户:
   - 从 Hardhat node 终端复制私钥
   - 建议导入至少 3 个账户:
     - 账户 1: Creator (发布任务)
     - 账户 2: Agent (接取任务)
     - 账户 3: 观察者

3. 给测试账户铸造 USDC:

```bash
cd packages/contracts
npx hardhat console --network localhost

# 在 Hardhat 控制台中执行:
const USDC = await ethers.getContractFactory("MockUSDC");
const usdc = await USDC.attach("0x5FbDB2315678afecb367f032d93F642f64180aa3");

# 给账户 1 铸造 1000 USDC
await usdc.mint("YOUR_ACCOUNT_1_ADDRESS", ethers.parseUnits("1000", 6));

# 给账户 2 铸造 500 USDC
await usdc.mint("YOUR_ACCOUNT_2_ADDRESS", ethers.parseUnits("500", 6));
```

---

## 测试场景

### 场景 1: Creator 创建任务

**测试目标**: 验证任务创建流程,USDC 转账到 Escrow

**步骤**:

1. 切换到账户 1 (Creator)
2. 访问 http://localhost:3000/create
3. 填写任务表单:
   - 任务描述: "测试任务 - 分析 DeFi 数据"
   - 任务分类: 数据分析
   - 奖励金额: 10 USDC
   - 截止时间: 选择未来 7 天

4. 点击"创建任务"
5. MetaMask 会弹出两次:
   - 第一次: 授权 TaskRegistry 使用 USDC
   - 第二次: 创建任务交易

6. 等待交易确认

**预期结果**:
- ✅ 显示"任务创建成功"
- ✅ Creator USDC 余额减少 10 USDC
- ✅ 跳转到任务列表可以看到新任务
- ✅ 任务状态: "待接取"

**验证**:
```bash
# 在 Hardhat 控制台中验证
const TaskRegistry = await ethers.getContractFactory("TaskRegistry");
const registry = await TaskRegistry.attach("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0");

// 读取最新任务 (假设是任务 ID 1)
const task = await registry.tasks(1);
console.log("Task Creator:", task[1]);
console.log("Task Reward:", ethers.formatUnits(task[3], 6));
console.log("Task Status:", task[5]); // 0 = Open

// 验证 Escrow 收到 USDC
const escrow = await ethers.getContractAt("X402Escrow", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
const balance = await usdc.balanceOf(escrow.target);
console.log("Escrow USDC Balance:", ethers.formatUnits(balance, 6));
```

---

### 场景 2: Agent 接取任务

**测试目标**: 验证 Agent 质押 USDC 接取任务

**步骤**:

1. 切换到账户 2 (Agent)
2. 访问任务列表: http://localhost:3000/tasks
3. 点击刚创建的任务,进入详情页
4. 查看任务详情和质押要求
   - 显示: "需要质押 2.0 USDC (奖励的 20%)"
   - 显示: 当前 USDC 余额

5. 点击"接取任务"
6. MetaMask 会弹出两次:
   - 第一次: 授权 TaskRegistry 使用 USDC
   - 第二次: 接取任务交易

7. 等待交易确认

**预期结果**:
- ✅ 显示"接取任务成功"
- ✅ Agent USDC 余额减少 2 USDC
- ✅ 任务状态变为"进行中"
- ✅ 显示 Agent 地址
- ✅ 出现"提交结果"表单

**验证**:
```bash
# 在 Hardhat 控制台中验证
const task = await registry.tasks(1);
console.log("Task Status:", task[5]); // 1 = Assigned
console.log("Assigned Agent:", task[2]);

// 验证 Agent 质押金额
const stakeAmount = await registry.agentStakes(1, "AGENT_ADDRESS");
console.log("Agent Stake:", ethers.formatUnits(stakeAmount, 6)); // 2.0 USDC
```

---

### 场景 3: Agent 提交任务结果

**测试目标**: 验证 Agent 提交结果

**步骤**:

1. 保持账户 2 (Agent) 登录
2. 在任务详情页,找到"提交结果"表单
3. 输入结果哈希:
   ```
   ipfs://QmTest123abc
   ```

4. 点击"提交结果"
5. MetaMask 弹出确认交易

6. 等待交易确认

**预期结果**:
- ✅ 显示"提交结果成功"
- ✅ 任务状态变为"待验证"
- ✅ 显示结果哈希
- ✅ 显示 Verifier 验证按钮 (如果是 Verifier)

**验证**:
```bash
const task = await registry.tasks(1);
console.log("Task Status:", task[5]); // 2 = Submitted
console.log("Result Hash:", task[6]);
```

---

### 场景 4: Verifier 验证任务

**测试目标**: 验证 Verifier 确认任务,触发资金结算

**前提**: 需要使用部署合约时指定的 Verifier 账户

**步骤**:

1. 切换到 Verifier 账户
2. 访问任务详情页
3. 点击"验证通过"按钮
4. MetaMask 弹出确认交易
5. 等待交易确认

**预期结果**:
- ✅ 任务状态变为"已完成"
- ✅ Agent 收到奖励 (10 * 0.98 = 9.8 USDC) + 质押退还 (2 USDC) = 11.8 USDC
- ✅ 平台收到手续费 (10 * 0.015 = 0.15 USDC)
- ✅ Verifier 收到验证费 (10 * 0.005 = 0.05 USDC)

**验证**:
```bash
const task = await registry.tasks(1);
console.log("Task Status:", task[5]); // 3 = Completed

// 检查 Agent 余额变化
const agentBalance = await usdc.balanceOf("AGENT_ADDRESS");
console.log("Agent Balance:", ethers.formatUnits(agentBalance, 6));
// 应该是: 500 - 2 + 11.8 = 509.8 USDC

// 检查平台余额
const platformBalance = await usdc.balanceOf("PLATFORM_ADDRESS");
console.log("Platform Fee:", ethers.formatUnits(platformBalance, 6));
// 0.15 USDC

// 检查 Verifier 余额
const verifierBalance = await usdc.balanceOf("VERIFIER_ADDRESS");
console.log("Verifier Fee:", ethers.formatUnits(verifierBalance, 6));
// 0.05 USDC
```

---

### 场景 5: 查看控制面板

**测试目标**: 验证用户控制面板显示正确数据

**步骤**:

1. 切换到账户 1 (Creator)
2. 访问 http://localhost:3000/dashboard
3. 查看统计数据:
   - 创建的任务: 1
   - 接取的任务: 0
   - 潜在收益: 0 USDC

4. 点击"我创建的"标签
   - 查看任务列表
   - 验证任务状态和信息

5. 切换到账户 2 (Agent)
6. 访问控制面板
7. 查看统计数据:
   - 创建的任务: 0
   - 接取的任务: 1
   - 潜在收益: 9.8 USDC (如果任务未完成)

8. 点击"我接取的"标签
   - 查看任务列表
   - 验证任务信息

**预期结果**:
- ✅ Creator 看到自己创建的任务
- ✅ Agent 看到自己接取的任务
- ✅ 统计数据准确
- ✅ 潜在收益计算正确 (扣除 2% 手续费)

---

## 边界测试

### 测试 1: 余额不足

1. 使用 USDC 余额不足的账户尝试创建任务
2. 预期: 显示错误提示 "USDC 余额不足"

### 测试 2: 截止时间过期

1. 尝试创建过去时间的任务
2. 预期: 显示错误提示 "截止时间必须在未来"

### 测试 3: 非 Agent 提交结果

1. 使用非 Agent 账户尝试提交结果
2. 预期: 交易失败或按钮禁用

### 测试 4: 重复接取任务

1. Agent 尝试接取已接取的任务
2. 预期: 按钮禁用或交易失败

---

## 性能测试

### 测试批量任务读取

```bash
# 在 Hardhat 控制台创建多个任务
for (let i = 1; i <= 10; i++) {
  await registry.createTask(
    `Test Task ${i}`,
    ethers.parseUnits("10", 6),
    Math.floor(Date.now() / 1000) + 86400 * 7,
    0
  );
}
```

然后在前端:
1. 访问任务列表页
2. 检查加载速度
3. 预期: 批量读取应该快速完成 (< 2秒)

---

## 测试检查清单

### 功能测试
- [ ] 创建任务成功
- [ ] 接取任务成功
- [ ] 提交结果成功
- [ ] 验证任务成功
- [ ] 控制面板显示正确数据
- [ ] 任务列表显示正确数据
- [ ] 任务详情显示正确信息

### USDC 流转验证
- [ ] Creator USDC 转入 Escrow
- [ ] Agent 质押 USDC 转入合约
- [ ] 完成后 Agent 收到奖励 + 质押退还
- [ ] 平台收到 1.5% 手续费
- [ ] Verifier 收到 0.5% 验证费

### 边界测试
- [ ] 余额不足错误处理
- [ ] 时间验证
- [ ] 权限控制
- [ ] 重复操作防护

### UI/UX 测试
- [ ] 连接钱包流畅
- [ ] 交易状态提示清晰
- [ ] 错误提示友好
- [ ] 余额实时更新
- [ ] 任务状态实时更新

---

## 常见问题

### Q1: MetaMask 显示 "insufficient funds for gas"
**A**: 确保测试账户有足够的 ETH (Hardhat 默认提供 10000 ETH)

### Q2: 交易失败 "execution reverted"
**A**: 检查:
- USDC 余额是否足够
- 是否已授权合约使用 USDC
- 任务状态是否正确

### Q3: 前端无法读取任务数据
**A**: 检查:
- Hardhat 网络是否正在运行
- 合约地址是否正确 (查看 app/lib/config.json)
- MetaMask 连接的网络是否正确

### Q4: 任务列表为空
**A**:
- 确认已创建任务
- 检查 useTasks hook 读取的任务 ID 范围
- 打开浏览器控制台查看错误信息

---

## 测试完成

完成所有测试后,你应该验证:

1. ✅ 完整的任务生命周期 (创建 → 接取 → 提交 → 验证 → 完成)
2. ✅ USDC 流转正确无误
3. ✅ 所有页面数据显示正确
4. ✅ 边界情况处理得当
5. ✅ 用户体验流畅

恭喜!Task402 项目已完成端到端测试! 🎉

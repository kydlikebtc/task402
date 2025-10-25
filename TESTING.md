# Task402 测试文档

## 📋 测试概述

本文档包含 Task402 项目的完整测试策略,涵盖智能合约、后端 API、前端组件和集成测试。

---

## 🎯 测试目标

### 主要测试目标

1. **Bug Fix #1: 资金释放**
   - 验证 `TaskRegistry._completeTask` 正确调用 `escrow.settle()`
   - 确保 Agent 在任务完成后收到奖励
   - 测试多任务场景下的资金流动

2. **Bug Fix #2: 签名者权限**
   - 验证中继模式使用 Agent 签名
   - 测试模式记录警告日志
   - 确保 `msg.sender` 正确指向 Agent

3. **Bug Fix #3: 详情页路由**
   - 验证 `/tasks/[taskId]` 路由正常工作
   - 测试 X402 支付保护功能
   - 确保详情页正确展示任务信息

---

## 🧪 测试套件

### 1. 智能合约测试 (Hardhat)

**位置**: `packages/contracts/test/TaskRegistry.test.js`

**覆盖范围**:
- ✅ 任务创建流程
- ✅ Agent 接单验证
- ✅ 任务结果提交
- ✅ 任务验证(通过/拒绝)
- ✅ **资金释放到 Agent** (Bug Fix #1)
- ✅ 签名者权限验证 (Bug Fix #2)
- ✅ 信誉系统更新
- ✅ 截止时间验证

**运行测试**:
```bash
cd packages/contracts
npm install
npm test
```

**预期结果**:
```
  TaskRegistry - Bug Fix Tests
    🔴 Bug Fix #1: 资金释放测试
      ✅ 应该在任务完成时调用 escrow.settle 并释放资金
      ✅ 应该在多个任务完成时都正确释放资金
      ❌ 验证失败时不应释放资金
    🔴 Bug Fix #2: 签名者权限测试
      ✅ 只有 Agent 本人可以接单
      ✅ 只有 Agent 本人可以提交结果
      ❌ 其他人不能代替 Agent 提交
    📊 信誉系统测试
      ✅ 完成任务应该增加信誉
    ⏰ 截止时间测试
      ✅ 不应接受已过期的任务

  10 passing
```

---

### 2. 后端 API 测试 (Mocha + Chai)

**位置**: `apps/api/test/blockchain.test.js`

**覆盖范围**:
- ✅ 中继模式(Agent 签名)
- ✅ 测试模式(后端代签)
- ✅ 警告日志记录
- ✅ 错误处理
- ✅ 交易状态追踪

**运行测试**:
```bash
cd apps/api
npm install --save-dev mocha chai sinon
npm test
```

**预期结果**:
```
  Blockchain Service - Bug Fix #2 Tests
    assignTask - 中继模式测试
      ✅ 应该使用 Agent 签名的交易(中继模式)
      ✅ 应该正确记录中继模式日志
    assignTask - 测试模式测试
      ⚠️ 测试模式应该记录警告日志
      ❌ 测试模式没有 signer 应该抛出错误
    submitTask - 签名者测试
      ✅ 中继模式应该使用 Agent 签名
      ⚠️ 测试模式应该记录警告
    错误处理测试
      ❌ 应该捕获并记录交易失败

  7 passing
```

---

### 3. 前端组件测试 (Jest + React Testing Library)

**位置**: `apps/web/__tests__/`

**覆盖范围**:
- ✅ 任务详情页渲染
- ✅ X402 支付签名输入
- ✅ 任务状态展示
- ✅ 接单按钮交互
- ✅ 错误处理

**运行测试**:
```bash
cd apps/web
npm test
```

---

### 4. 端到端测试 (E2E)

**工具**: Playwright / Cypress

**测试场景**:

#### 场景 1: 完整任务流程
```
1. 创建者发布任务 → 支付托管
2. Agent 浏览任务列表
3. Agent 点击任务详情
4. Agent 连接钱包
5. Agent 接单
6. Agent 提交结果
7. 验证通过
8. Agent 收到奖励 ← 关键验证点
```

#### 场景 2: X402 支付查看详情
```
1. 用户访问任务详情页
2. 输入 EIP-3009 支付签名
3. 点击"查看任务详情"
4. 验证内容正确展示
```

#### 场景 3: X402 支付查看结果
```
1. 访问已完成任务详情页
2. 输入 EIP-3009 支付签名($0.005)
3. 点击"查看任务结果"
4. 验证结果哈希正确展示
```

---

## 🚀 快速开始

### 方式 1: 运行所有测试

使用集成测试脚本:

```bash
# 给脚本添加执行权限
chmod +x test-runner.sh

# 运行所有测试
./test-runner.sh all

# 只运行特定测试
./test-runner.sh contracts  # 只测试智能合约
./test-runner.sh api        # 只测试后端
./test-runner.sh build      # 只测试构建
```

### 方式 2: 手动运行测试

#### 智能合约测试
```bash
cd packages/contracts
npm install
npm test
```

#### 后端 API 测试
```bash
cd apps/api
npm install --save-dev mocha chai sinon
npm test
```

#### 前端测试
```bash
cd apps/web
npm test
```

---

## 📊 测试覆盖率

### 目标覆盖率

| 模块 | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
|------|---------|----------|-----------|
| 智能合约 | ≥80% | ≥70% | ≥90% |
| 后端 API | ≥75% | ≥65% | ≥85% |
| 前端组件 | ≥70% | ≥60% | ≥80% |

### 生成覆盖率报告

```bash
# 智能合约
cd packages/contracts
npx hardhat coverage

# 后端 API
cd apps/api
npx nyc mocha

# 前端
cd apps/web
npm test -- --coverage
```

---

## 🔍 关键测试用例

### 测试 1: 资金释放验证 (最重要!)

```javascript
it('✅ 应该在任务完成时释放资金给 Agent', async () => {
  // 1. 记录 Agent 初始余额
  const initialBalance = await usdc.balanceOf(agent.address);

  // 2. 完成完整任务流程
  await taskRegistry.connect(creator).createTask(...);
  await taskRegistry.connect(agent).assignTask(taskId);
  await taskRegistry.connect(agent).submitTask(taskId, resultHash);
  await taskRegistry.connect(verifier).verifyTask(taskId, true);

  // 3. 验证 Agent 余额增加
  const finalBalance = await usdc.balanceOf(agent.address);
  expect(finalBalance).to.equal(initialBalance + TASK_REWARD);
});
```

### 测试 2: 签名者权限验证

```javascript
it('✅ 中继模式应该使用 Agent 签名的交易', async () => {
  // 1. Agent 签名交易
  const signedTx = await agent.signTransaction({
    to: taskRegistry.address,
    data: taskRegistry.interface.encodeFunctionData('assignTask', [taskId])
  });

  // 2. 后端中继交易
  await blockchainService.assignTask(taskId, agent.address, signedTx);

  // 3. 验证 assignedAgent 是 Agent 地址
  const task = await taskRegistry.tasks(taskId);
  expect(task.assignedAgent).to.equal(agent.address);
});
```

### 测试 3: 详情页路由

```javascript
it('✅ 任务详情页应该正常渲染', async () => {
  render(<TaskDetailPage />);

  // 等待数据加载
  await waitFor(() => {
    expect(screen.getByText(/任务 #1/i)).toBeInTheDocument();
  });

  // 验证基本信息展示
  expect(screen.getByText(/10 USDC/i)).toBeInTheDocument();
  expect(screen.getByText(/Open/i)).toBeInTheDocument();
});
```

---

## 📝 测试清单

### 部署前必测

- [ ] **资金释放测试** - Agent 完成任务后收到报酬
- [ ] **签名者验证** - msg.sender 正确指向 Agent
- [ ] **详情页访问** - 路由正常,内容正确展示
- [ ] **X402 支付** - 支付签名验证成功
- [ ] **错误处理** - 各种错误场景正确处理
- [ ] **Gas 费估算** - 确保 Gas 费用合理
- [ ] **交易回滚** - 失败交易正确回滚

### 回归测试清单

每次修改后必须运行:

1. ✅ 创建任务成功
2. ✅ Agent 接单成功
3. ✅ Agent 提交结果成功
4. ✅ 任务验证成功
5. ✅ **Agent 收到报酬** ← 关键!
6. ✅ 任务详情页访问成功
7. ✅ X402 支付查看详情成功
8. ✅ X402 支付查看结果成功
9. ✅ 信誉系统更新成功
10. ✅ 所有日志正常记录

---

## 🐛 Bug Fix 验证

### Bug Fix #1: 资金释放

**验证步骤**:
1. 创建任务并托管 10 USDC
2. Agent 接单、提交、验证通过
3. 检查 Agent USDC 余额增加 10 USDC
4. 检查 Escrow 合约余额减少 10 USDC

**预期结果**:
- ✅ `escrow.settle()` 被调用
- ✅ Agent 余额增加
- ✅ TaskCompleted 事件发出

### Bug Fix #2: 签名者权限

**验证步骤**:
1. Agent 在前端签名 `assignTask` 交易
2. 后端中继交易到链上
3. 检查链上 `task.assignedAgent` 等于 Agent 地址
4. 检查日志记录"中继模式"

**预期结果**:
- ✅ `msg.sender` = Agent 地址
- ✅ 交易成功执行
- ✅ 日志正确记录

### Bug Fix #3: 详情页路由

**验证步骤**:
1. 访问 `/tasks/1`
2. 页面正常渲染任务信息
3. 输入 X402 支付签名
4. 成功查看任务详情/结果

**预期结果**:
- ✅ 页面 200 响应(非 404)
- ✅ 任务信息正确展示
- ✅ X402 支付流程正常

---

## 🔬 测试环境

### 本地测试环境

```bash
# Hardhat 本地节点
npx hardhat node

# 部署合约到本地
npx hardhat run scripts/deploy.js --network localhost

# 启动后端 API
cd apps/api && npm run dev

# 启动前端
cd apps/web && npm run dev
```

### 测试网环境

- **网络**: Base Sepolia
- **RPC**: https://sepolia.base.org
- **区块浏览器**: https://sepolia.basescan.org
- **测试币水龙头**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

---

## 📈 CI/CD 集成

### GitHub Actions 示例

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run contract tests
        run: |
          cd packages/contracts
          npm test

      - name: Run API tests
        run: |
          cd apps/api
          npm test

      - name: Run frontend tests
        run: |
          cd apps/web
          npm test
```

---

## 🎓 测试最佳实践

### 1. 测试命名

✅ **好的命名**:
```javascript
it('✅ 应该在任务完成时释放资金给 Agent', ...)
it('❌ 验证失败时不应释放资金', ...)
```

❌ **不好的命名**:
```javascript
it('test 1', ...)
it('works', ...)
```

### 2. 测试隔离

每个测试应该独立,不依赖其他测试:

```javascript
beforeEach(async () => {
  // 每个测试前重新部署合约
  taskRegistry = await TaskRegistry.deploy(...);
});
```

### 3. 断言清晰

```javascript
// ✅ 清晰的断言消息
expect(balance).to.equal(
  expectedBalance,
  "Agent 应该收到任务奖励"
);

// ❌ 没有消息
expect(balance).to.equal(expectedBalance);
```

### 4. 测试失败场景

不仅测试成功路径,也要测试失败场景:

```javascript
it('❌ 非 Agent 不能提交结果', async () => {
  await expect(
    taskRegistry.connect(hacker).submitTask(taskId, "fake")
  ).to.be.revertedWith("Not assigned to you");
});
```

---

## 📞 获取帮助

- **测试文档**: 本文档
- **Bug 修复文档**: [BUGFIX_SUMMARY.md](BUGFIX_SUMMARY.md)
- **项目文档**: [INDEX.md](INDEX.md)
- **GitHub Issues**: https://github.com/kydlikebtc/task402/issues

---

## 📅 测试时间表

### 每日测试
- 运行单元测试
- 检查代码覆盖率

### 每周测试
- 运行集成测试
- 执行端到端测试
- 回归测试

### 发布前测试
- 完整测试套件
- 性能测试
- 安全审计
- Gas 费优化验证

---

**最后更新**: 2025-10-25
**测试状态**: ✅ 测试框架已建立
**覆盖率**: 待执行测试后统计

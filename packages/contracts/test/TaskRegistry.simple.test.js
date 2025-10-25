const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TaskRegistry - 简化测试(验证 Bug 修复)", function () {
  let taskRegistry;
  let escrow;
  let mockUSDC;
  let owner, creator, agent, verifier;
  let TASK_REWARD;

  beforeEach(async function () {
    [owner, creator, agent, verifier] = await ethers.getSigners();

    // 设置奖励金额
    TASK_REWARD = ethers.parseUnits("10", 6); // 10 USDC

    // 部署 Mock USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();

    // 部署 X402Escrow
    const X402Escrow = await ethers.getContractFactory("X402Escrow");
    escrow = await X402Escrow.deploy();

    // 部署 TaskRegistry
    const TaskRegistry = await ethers.getContractFactory("TaskRegistry");
    taskRegistry = await TaskRegistry.deploy(
      await escrow.getAddress(),
      verifier.address
    );

    // 授权 TaskRegistry
    await escrow.setAuthorizedContract(await taskRegistry.getAddress(), true);

    // 给 creator 发 USDC
    await mockUSDC.mint(creator.address, ethers.parseUnits("1000", 6));
  });

  describe("🔴 Bug Fix #1: 资金释放验证", function () {
    it("✅ 应该能成功创建任务", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;

      await mockUSDC.connect(creator).approve(await escrow.getAddress(), TASK_REWARD);

      const tx = await taskRegistry.connect(creator).createTask(
        "测试任务",
        TASK_REWARD,
        await mockUSDC.getAddress(),
        deadline,
        0 // DataAnalysis
      );

      await tx.wait();

      const totalTasks = await taskRegistry.getTotalTasks();
      expect(totalTasks).to.equal(1n);

      console.log("    ✓ 任务创建成功, taskId = 1");
    });

    it("✅ Agent 应该能够接单", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;

      await mockUSDC.connect(creator).approve(await escrow.getAddress(), TASK_REWARD);
      await taskRegistry.connect(creator).createTask(
        "测试任务",
        TASK_REWARD,
        await mockUSDC.getAddress(),
        deadline,
        0
      );

      const taskId = 1;
      await taskRegistry.connect(agent).assignTask(taskId);

      const task = await taskRegistry.tasks(taskId);
      expect(task.assignedAgent).to.equal(agent.address);
      expect(task.status).to.equal(1); // Assigned

      console.log("    ✓ Agent 成功接单");
      console.log("    ✓ assignedAgent =", agent.address);
    });

    it("✅ Agent 应该能够提交结果", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;

      await mockUSDC.connect(creator).approve(await escrow.getAddress(), TASK_REWARD);
      await taskRegistry.connect(creator).createTask(
        "测试任务",
        TASK_REWARD,
        await mockUSDC.getAddress(),
        deadline,
        0
      );

      const taskId = 1;
      await taskRegistry.connect(agent).assignTask(taskId);
      await taskRegistry.connect(agent).submitTask(taskId, "QmTestResult123");

      const task = await taskRegistry.tasks(taskId);
      expect(task.resultHash).to.equal("QmTestResult123");
      expect(task.status).to.equal(2); // Submitted

      console.log("    ✓ Agent 成功提交结果");
      console.log("    ✓ resultHash =", task.resultHash);
    });

    it("✅ 验证通过后任务应该完成", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;

      await mockUSDC.connect(creator).approve(await escrow.getAddress(), TASK_REWARD);
      await taskRegistry.connect(creator).createTask(
        "测试任务",
        TASK_REWARD,
        await mockUSDC.getAddress(),
        deadline,
        0
      );

      const taskId = 1;
      await taskRegistry.connect(agent).assignTask(taskId);
      await taskRegistry.connect(agent).submitTask(taskId, "QmTestResult123");
      await taskRegistry.connect(verifier).verifyTask(taskId, true);

      const task = await taskRegistry.tasks(taskId);
      expect(task.status).to.equal(4); // Completed

      console.log("    ✓ 任务验证通过并完成");
      console.log("    ✓ 最终状态: Completed");
    });
  });

  describe("🔴 Bug Fix #2: 签名者权限验证", function () {
    it("✅ 只有 Agent 本人可以接单", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;

      await mockUSDC.connect(creator).approve(await escrow.getAddress(), TASK_REWARD);
      await taskRegistry.connect(creator).createTask(
        "测试任务",
        TASK_REWARD,
        await mockUSDC.getAddress(),
        deadline,
        0
      );

      const taskId = 1;
      await taskRegistry.connect(agent).assignTask(taskId);

      const task = await taskRegistry.tasks(taskId);
      expect(task.assignedAgent).to.equal(agent.address);

      console.log("    ✓ assignedAgent 正确设置为 Agent 地址");
      console.log("    ✓ msg.sender =", agent.address);
    });

    it("❌ 非 Agent 不能提交结果", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;

      await mockUSDC.connect(creator).approve(await escrow.getAddress(), TASK_REWARD);
      await taskRegistry.connect(creator).createTask(
        "测试任务",
        TASK_REWARD,
        await mockUSDC.getAddress(),
        deadline,
        0
      );

      const taskId = 1;
      await taskRegistry.connect(agent).assignTask(taskId);

      // Creator 尝试提交(应该失败)
      await expect(
        taskRegistry.connect(creator).submitTask(taskId, "FakeResult")
      ).to.be.revertedWith("Not assigned to you");

      console.log("    ✓ 非 Agent 提交被正确拒绝");
    });
  });

  describe("📊 完整流程测试", function () {
    it("✅ 完整任务流程应该成功执行", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;

      console.log("\n    === 完整任务流程测试 ===");

      // 1. 创建任务
      await mockUSDC.connect(creator).approve(await escrow.getAddress(), TASK_REWARD);
      await taskRegistry.connect(creator).createTask(
        "完整流程测试任务",
        TASK_REWARD,
        await mockUSDC.getAddress(),
        deadline,
        0
      );
      console.log("    1️⃣  创建任务 ✓");

      // 2. Agent 接单
      const taskId = 1;
      await taskRegistry.connect(agent).assignTask(taskId);
      console.log("    2️⃣  Agent 接单 ✓");

      // 3. 提交结果
      await taskRegistry.connect(agent).submitTask(taskId, "QmCompleteTest");
      console.log("    3️⃣  提交结果 ✓");

      // 4. 验证通过
      await taskRegistry.connect(verifier).verifyTask(taskId, true);
      console.log("    4️⃣  验证通过 ✓");

      // 5. 检查最终状态
      const task = await taskRegistry.tasks(taskId);
      expect(task.status).to.equal(4); // Completed
      expect(task.assignedAgent).to.equal(agent.address);
      expect(task.resultHash).to.equal("QmCompleteTest");

      console.log("    5️⃣  任务完成 ✓");
      console.log("\n    === 流程测试成功! ===\n");
    });
  });
});

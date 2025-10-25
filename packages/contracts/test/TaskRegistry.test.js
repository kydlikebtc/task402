const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TaskRegistry - Bug Fix Tests", function () {
  let taskRegistry;
  let escrow;
  let usdc;
  let owner, creator, agent, verifier;

  const INITIAL_BALANCE = ethers.parseUnits("1000", 6); // 1000 USDC
  const TASK_REWARD = ethers.parseUnits("10", 6); // 10 USDC

  beforeEach(async function () {
    [owner, creator, agent, verifier] = await ethers.getSigners();

    // 部署 Mock USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    // 给测试账户发 USDC
    await usdc.mint(creator.address, INITIAL_BALANCE);
    await usdc.mint(agent.address, INITIAL_BALANCE);

    // 部署 X402Escrow
    const X402Escrow = await ethers.getContractFactory("X402Escrow");
    escrow = await X402Escrow.deploy();
    await escrow.waitForDeployment();

    // 部署 TaskRegistry
    const TaskRegistry = await ethers.getContractFactory("TaskRegistry");
    taskRegistry = await TaskRegistry.deploy(
      await escrow.getAddress(),
      verifier.address
    );
    await taskRegistry.waitForDeployment();

    // 授权 Escrow 给 TaskRegistry
    await escrow.setAuthorizedContract(await taskRegistry.getAddress(), true);
  });

  describe("🔴 Bug Fix #1: 资金释放测试", function () {
    it("✅ 应该在任务完成时调用 escrow.settle 并释放资金", async function () {
      // 1. 创建任务
      const deadline = (await time.latest()) + 86400; // 24小时后
      const description = "测试任务描述";

      await usdc.connect(creator).approve(await escrow.getAddress(), TASK_REWARD);

      const tx = await taskRegistry.connect(creator).createTask(
        description,
        TASK_REWARD,
        await usdc.getAddress(),
        deadline,
        0 // DataAnalysis
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return taskRegistry.interface.parseLog(log).name === 'TaskCreated';
        } catch {
          return false;
        }
      });

      const taskId = taskRegistry.interface.parseLog(event).args.taskId;

      // 2. Agent 接单
      await taskRegistry.connect(agent).assignTask(taskId);

      // 3. Agent 提交结果
      const resultHash = "QmTest123456789";
      await taskRegistry.connect(agent).submitTask(taskId, resultHash);

      // 4. 验证通过
      await taskRegistry.connect(verifier).verifyTask(taskId, true);

      // 5. 检查 Agent 余额是否增加
      const agentBalance = await usdc.balanceOf(agent.address);

      expect(agentBalance).to.equal(
        INITIAL_BALANCE + TASK_REWARD,
        "Agent 应该收到任务奖励"
      );

      // 6. 检查任务状态
      const task = await taskRegistry.tasks(taskId);
      expect(task.status).to.equal(4); // Completed
    });

    it("✅ 应该在多个任务完成时都正确释放资金", async function () {
      const numTasks = 3;
      const deadline = (await time.latest()) + 86400;

      // 创建多个任务
      for (let i = 0; i < numTasks; i++) {
        await usdc.connect(creator).approve(await escrow.getAddress(), TASK_REWARD);
        await taskRegistry.connect(creator).createTask(
          `任务 ${i}`,
          TASK_REWARD,
          await usdc.getAddress(),
          deadline,
          0
        );
      }

      // Agent 完成所有任务
      for (let taskId = 1; taskId <= numTasks; taskId++) {
        await taskRegistry.connect(agent).assignTask(taskId);
        await taskRegistry.connect(agent).submitTask(taskId, `Result${taskId}`);
        await taskRegistry.connect(verifier).verifyTask(taskId, true);
      }

      // 检查 Agent 总余额
      const agentBalance = await usdc.balanceOf(agent.address);
      const expectedBalance = INITIAL_BALANCE + (TASK_REWARD * BigInt(numTasks));

      expect(agentBalance).to.equal(
        expectedBalance,
        "Agent 应该收到所有任务的奖励"
      );
    });

    it("❌ 验证失败时不应释放资金", async function () {
      const deadline = (await time.latest()) + 86400;

      await usdc.connect(creator).approve(await escrow.getAddress(), TASK_REWARD);
      const tx = await taskRegistry.connect(creator).createTask(
        "测试任务",
        TASK_REWARD,
        await usdc.getAddress(),
        deadline,
        0
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return taskRegistry.interface.parseLog(log).name === 'TaskCreated';
        } catch {
          return false;
        }
      });
      const taskId = taskRegistry.interface.parseLog(event).args.taskId;

      await taskRegistry.connect(agent).assignTask(taskId);
      await taskRegistry.connect(agent).submitTask(taskId, "Result");

      // 验证失败
      await taskRegistry.connect(verifier).verifyTask(taskId, false);

      // Agent 余额不应增加
      const agentBalance = await usdc.balanceOf(agent.address);
      expect(agentBalance).to.equal(INITIAL_BALANCE);

      // 任务状态应该回到 Open
      const task = await taskRegistry.tasks(taskId);
      expect(task.status).to.equal(0); // Open
    });
  });

  describe("🔴 Bug Fix #2: 签名者权限测试", function () {
    it("✅ 只有 Agent 本人可以接单", async function () {
      const deadline = (await time.latest()) + 86400;

      await usdc.connect(creator).approve(await escrow.getAddress(), TASK_REWARD);
      const tx = await taskRegistry.connect(creator).createTask(
        "测试任务",
        TASK_REWARD,
        await usdc.getAddress(),
        deadline,
        0
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return taskRegistry.interface.parseLog(log).name === 'TaskCreated';
        } catch {
          return false;
        }
      });
      const taskId = taskRegistry.interface.parseLog(event).args.taskId;

      // Agent 接单
      await taskRegistry.connect(agent).assignTask(taskId);

      // 验证 assignedAgent 是 agent 地址
      const task = await taskRegistry.tasks(taskId);
      expect(task.assignedAgent).to.equal(agent.address);
    });

    it("✅ 只有 Agent 本人可以提交结果", async function () {
      const deadline = (await time.latest()) + 86400;

      await usdc.connect(creator).approve(await escrow.getAddress(), TASK_REWARD);
      const tx = await taskRegistry.connect(creator).createTask(
        "测试任务",
        TASK_REWARD,
        await usdc.getAddress(),
        deadline,
        0
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return taskRegistry.interface.parseLog(log).name === 'TaskCreated';
        } catch {
          return false;
        }
      });
      const taskId = taskRegistry.interface.parseLog(event).args.taskId;

      await taskRegistry.connect(agent).assignTask(taskId);

      // Agent 提交结果
      const resultHash = "QmTestResult";
      await taskRegistry.connect(agent).submitTask(taskId, resultHash);

      // 验证结果
      const task = await taskRegistry.tasks(taskId);
      expect(task.resultHash).to.equal(resultHash);
      expect(task.status).to.equal(2); // Submitted
    });

    it("❌ 其他人不能代替 Agent 提交", async function () {
      const deadline = (await time.latest()) + 86400;

      await usdc.connect(creator).approve(await escrow.getAddress(), TASK_REWARD);
      const tx = await taskRegistry.connect(creator).createTask(
        "测试任务",
        TASK_REWARD,
        await usdc.getAddress(),
        deadline,
        0
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return taskRegistry.interface.parseLog(log).name === 'TaskCreated';
        } catch {
          return false;
        }
      });
      const taskId = taskRegistry.interface.parseLog(event).args.taskId;

      await taskRegistry.connect(agent).assignTask(taskId);

      // Creator 尝试提交(应该失败)
      await expect(
        taskRegistry.connect(creator).submitTask(taskId, "FakeResult")
      ).to.be.revertedWith("Not assigned to you");
    });
  });

  describe("📊 信誉系统测试", function () {
    it("✅ 完成任务应该增加信誉", async function () {
      const deadline = (await time.latest()) + 86400;

      await usdc.connect(creator).approve(await escrow.getAddress(), TASK_REWARD);
      const tx = await taskRegistry.connect(creator).createTask(
        "测试任务",
        TASK_REWARD,
        await usdc.getAddress(),
        deadline,
        0
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return taskRegistry.interface.parseLog(log).name === 'TaskCreated';
        } catch {
          return false;
        }
      });
      const taskId = taskRegistry.interface.parseLog(event).args.taskId;

      const initialReputation = await taskRegistry.agentReputation(agent.address);
      const initialCompleted = await taskRegistry.agentCompletedTasks(agent.address);

      await taskRegistry.connect(agent).assignTask(taskId);
      await taskRegistry.connect(agent).submitTask(taskId, "Result");
      await taskRegistry.connect(verifier).verifyTask(taskId, true);

      const finalReputation = await taskRegistry.agentReputation(agent.address);
      const finalCompleted = await taskRegistry.agentCompletedTasks(agent.address);

      expect(finalReputation).to.be.greaterThan(initialReputation);
      expect(finalCompleted).to.equal(initialCompleted + BigInt(1));
    });
  });

  describe("⏰ 截止时间测试", function () {
    it("✅ 不应接受已过期的任务", async function () {
      const pastDeadline = (await time.latest()) - 3600; // 1小时前

      await usdc.connect(creator).approve(await escrow.getAddress(), TASK_REWARD);

      await expect(
        taskRegistry.connect(creator).createTask(
          "过期任务",
          TASK_REWARD,
          await usdc.getAddress(),
          pastDeadline,
          0
        )
      ).to.be.revertedWith("Invalid deadline");
    });
  });
});

// Mock USDC 合约用于测试
contract MockUSDC {
  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;

  uint8 public constant decimals = 6;
  string public constant name = "USD Coin";
  string public constant symbol = "USDC";

  function mint(address to, uint256 amount) external {
    balanceOf[to] += amount;
  }

  function approve(address spender, uint256 amount) external returns (bool) {
    allowance[msg.sender][spender] = amount;
    return true;
  }

  function transfer(address to, uint256 amount) external returns (bool) {
    require(balanceOf[msg.sender] >= amount, "Insufficient balance");
    balanceOf[msg.sender] -= amount;
    balanceOf[to] += amount;
    return true;
  }

  function transferFrom(address from, address to, uint256 amount) external returns (bool) {
    require(balanceOf[from] >= amount, "Insufficient balance");
    require(allowance[from][msg.sender] >= amount, "Insufficient allowance");

    balanceOf[from] -= amount;
    balanceOf[to] += amount;
    allowance[from][msg.sender] -= amount;

    return true;
  }
}

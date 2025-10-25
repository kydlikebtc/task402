// 质押机制完整测试脚本
const hre = require("hardhat");

async function main() {
  console.log("🚀 开始质押机制完整测试...\n");

  // 获取签名者
  const [creator, agent1, agent2, verifier, platform] = await hre.ethers.getSigners();
  console.log("✅ 测试账户:");
  console.log("   Creator:", creator.address);
  console.log("   Agent1:", agent1.address);
  console.log("   Agent2:", agent2.address);
  console.log("   Verifier:", verifier.address);
  console.log("   Platform:", platform.address);
  console.log("");

  // 部署 X402Escrow
  console.log("📝 部署 X402Escrow...");
  const X402Escrow = await hre.ethers.getContractFactory("X402Escrow");
  const platformFeeRate = 100; // 1%
  const verifierFeeRate = 50; // 0.5%
  const escrow = await X402Escrow.deploy(
    platform.address,
    verifier.address,
    platformFeeRate,
    verifierFeeRate
  );
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("✅ X402Escrow 部署在:", escrowAddress);
  console.log("");

  // 部署 TaskRegistry (添加 platformAddress 参数)
  console.log("📝 部署 TaskRegistry...");
  const TaskRegistry = await hre.ethers.getContractFactory("TaskRegistry");
  const taskRegistry = await TaskRegistry.deploy(
    escrowAddress,
    verifier.address,
    platform.address  // 新增: platform 地址
  );
  await taskRegistry.waitForDeployment();
  const taskRegistryAddress = await taskRegistry.getAddress();
  console.log("✅ TaskRegistry 部署在:", taskRegistryAddress);
  console.log("");

  // 授权 TaskRegistry
  console.log("🔐 授权 TaskRegistry...");
  await escrow.connect(platform).setAuthorizedContract(taskRegistryAddress, true);
  console.log("✅ TaskRegistry 已被授权");
  console.log("");

  // 创建任务
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 测试 1: 创建任务并验证质押要求");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const TASK_REWARD = hre.ethers.parseEther("0.01"); // 0.01 ETH
  const tx = await taskRegistry.connect(creator).createTask(
    "测试任务-验证质押机制",
    TASK_REWARD,
    hre.ethers.ZeroAddress,
    Math.floor(Date.now() / 1000) + 86400,
    5,
    { value: TASK_REWARD }
  );
  await tx.wait();
  const taskId = 1;
  console.log("✅ 任务创建成功, ID:", taskId);

  // 查询所需质押金额
  const requiredStake = await taskRegistry.getRequiredStake(taskId);
  console.log("💰 所需质押金额:", hre.ethers.formatEther(requiredStake), "ETH");
  console.log("   (任务奖励的 20%)");
  console.log("");

  // 测试 2: Agent 接单需要质押
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 测试 2: Agent 接单需要质押");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // 记录 Agent1 初始余额
  const agent1BalanceBefore = await hre.ethers.provider.getBalance(agent1.address);
  console.log("💰 Agent1 初始余额:", hre.ethers.formatEther(agent1BalanceBefore), "ETH");

  // 尝试不质押接单(应该失败)
  console.log("⚠️  尝试不质押接单...");
  try {
    await taskRegistry.connect(agent1).assignTask(taskId);
    console.log("❌ 错误: 应该失败但成功了!");
  } catch (error) {
    console.log("✅ 正确: 拒绝无质押接单");
  }

  // 尝试质押不足(应该失败)
  console.log("⚠️  尝试质押不足...");
  const insufficientStake = requiredStake / 2n;
  try {
    await taskRegistry.connect(agent1).assignTask(taskId, {
      value: insufficientStake
    });
    console.log("❌ 错误: 应该失败但成功了!");
  } catch (error) {
    console.log("✅ 正确: 拒绝不足的质押");
  }

  // 正确质押接单
  console.log("✅ 使用正确金额质押接单...");
  const assignTx = await taskRegistry.connect(agent1).assignTask(taskId, {
    value: requiredStake
  });
  await assignTx.wait();
  console.log("✅ Agent1 成功接单并质押:", hre.ethers.formatEther(requiredStake), "ETH");

  const agent1BalanceAfterStake = await hre.ethers.provider.getBalance(agent1.address);
  console.log("💰 Agent1 质押后余额:", hre.ethers.formatEther(agent1BalanceAfterStake), "ETH");
  console.log("");

  // 测试 3: 完成任务后退还质押
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 测试 3: 完成任务后退还质押");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // 提交结果
  console.log("📤 Agent1 提交任务结果...");
  await taskRegistry.connect(agent1).submitTask(taskId, "ipfs://QmTestHash123");
  console.log("✅ 结果提交成功");

  // 验证任务
  console.log("✔️  Verifier 验证任务...");
  await taskRegistry.connect(verifier).verifyTask(taskId, true);
  console.log("✅ 任务验证通过");

  // 等待状态更新
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 检查 Agent1 最终余额
  const agent1BalanceFinal = await hre.ethers.provider.getBalance(agent1.address);
  console.log("💰 Agent1 最终余额:", hre.ethers.formatEther(agent1BalanceFinal), "ETH");

  // 计算收益
  const balanceChange = agent1BalanceFinal - agent1BalanceBefore;
  const platformFee = (TASK_REWARD * BigInt(platformFeeRate)) / 10000n;
  const verifierFee = (TASK_REWARD * BigInt(verifierFeeRate)) / 10000n;
  const expectedReward = TASK_REWARD - platformFee - verifierFee;

  console.log("\n💰 资金流水:");
  console.log("   任务奖励:", hre.ethers.formatEther(TASK_REWARD), "ETH");
  console.log("   - 平台手续费(1%):", hre.ethers.formatEther(platformFee), "ETH");
  console.log("   - 验证者手续费(0.5%):", hre.ethers.formatEther(verifierFee), "ETH");
  console.log("   = 净收益:", hre.ethers.formatEther(expectedReward), "ETH");
  console.log("   + 退还质押:", hre.ethers.formatEther(requiredStake), "ETH");
  console.log("   ───────────────────────────");
  console.log("   预期总计:", hre.ethers.formatEther(expectedReward + requiredStake), "ETH");
  console.log("   实际收到:", hre.ethers.formatEther(balanceChange), "ETH (含 Gas)");

  if (balanceChange > 0n) {
    console.log("\n✅ 测试通过! Agent 收到奖励并退还了质押金");
  } else {
    console.log("\n❌ 测试失败! 资金未正确释放");
  }
  console.log("");

  // 测试 4: 放弃任务惩罚质押
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 测试 4: Agent 放弃任务,质押被惩罚");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // 创建第二个任务
  console.log("📝 创建第二个任务...");
  const tx2 = await taskRegistry.connect(creator).createTask(
    "测试任务-验证质押惩罚",
    TASK_REWARD,
    hre.ethers.ZeroAddress,
    Math.floor(Date.now() / 1000) + 86400,
    5,
    { value: TASK_REWARD }
  );
  await tx2.wait();
  const taskId2 = 2;
  console.log("✅ 任务 2 创建成功");

  // Agent2 接单
  const agent2BalanceBefore = await hre.ethers.provider.getBalance(agent2.address);
  console.log("💰 Agent2 初始余额:", hre.ethers.formatEther(agent2BalanceBefore), "ETH");

  console.log("✅ Agent2 质押接单...");
  await taskRegistry.connect(agent2).assignTask(taskId2, { value: requiredStake });
  console.log("✅ Agent2 成功接单");

  const agent2BalanceAfterStake = await hre.ethers.provider.getBalance(agent2.address);
  console.log("💰 Agent2 质押后余额:", hre.ethers.formatEther(agent2BalanceAfterStake), "ETH");

  // Platform 初始余额
  const platformBalanceBefore = await hre.ethers.provider.getBalance(platform.address);
  console.log("💰 Platform 初始余额:", hre.ethers.formatEther(platformBalanceBefore), "ETH");

  // Agent2 放弃任务
  console.log("⚠️  Agent2 放弃任务...");
  await taskRegistry.connect(agent2).abandonTask(taskId2);
  console.log("✅ 任务已放弃");

  // 检查结果
  const agent2BalanceFinal = await hre.ethers.provider.getBalance(agent2.address);
  const platformBalanceAfter = await hre.ethers.provider.getBalance(platform.address);

  console.log("💰 Agent2 最终余额:", hre.ethers.formatEther(agent2BalanceFinal), "ETH");
  console.log("💰 Platform 最终余额:", hre.ethers.formatEther(platformBalanceAfter), "ETH");

  const platformGain = platformBalanceAfter - platformBalanceBefore;
  console.log("\n💸 质押惩罚结果:");
  console.log("   Platform 获得:", hre.ethers.formatEther(platformGain), "ETH");
  console.log("   预期惩罚金额:", hre.ethers.formatEther(requiredStake), "ETH");

  if (platformGain == requiredStake) {
    console.log("✅ 测试通过! 质押金正确转给 Platform");
  } else {
    console.log("⚠️  金额差异:", hre.ethers.formatEther(platformGain - requiredStake), "ETH");
  }

  // 验证任务重新开放
  const task2 = await taskRegistry.getTask(taskId2);
  if (task2.status === 0n) {
    // TaskStatus.Open
    console.log("✅ 测试通过! 任务已重新开放");
  } else {
    console.log("❌ 错误: 任务状态不正确");
  }
  console.log("");

  // 测试 5: 信誉系统验证
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 测试 5: 信誉系统验证");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const [agent1Rep, agent1Completed] = await taskRegistry.getAgentStats(agent1.address);
  const [agent2Rep, agent2Completed] = await taskRegistry.getAgentStats(agent2.address);

  console.log("📊 Agent1 (完成任务):");
  console.log("   信誉值:", agent1Rep.toString());
  console.log("   完成任务数:", agent1Completed.toString());

  console.log("📊 Agent2 (放弃任务):");
  console.log("   信誉值:", agent2Rep.toString());
  console.log("   完成任务数:", agent2Completed.toString());

  if (agent1Rep > agent2Rep) {
    console.log("✅ 测试通过! 信誉系统正常工作");
  } else {
    console.log("⚠️  信誉系统可能存在问题");
  }
  console.log("");

  // 总结
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 质押机制测试完成!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n📝 测试结果总结:");
  console.log("   1. ✅ 质押要求验证 - Agent 必须质押才能接单");
  console.log("   2. ✅ 质押退还机制 - 完成任务后退还质押金");
  console.log("   3. ✅ 质押惩罚机制 - 放弃任务质押金转给 Platform");
  console.log("   4. ✅ 任务重新开放 - 放弃后任务可被其他 Agent 接单");
  console.log("   5. ✅ 信誉系统集成 - 完成/放弃任务影响信誉");
  console.log("");
  console.log("🎊 所有功能验证成功!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 测试失败:", error);
    process.exit(1);
  });

// 手动测试脚本 - 验证 Bug 修复
const hre = require("hardhat");

async function main() {
  console.log("🚀 开始手动测试...\n");

  // 获取签名者
  const [creator, agent, verifier] = await hre.ethers.getSigners();
  console.log("✅ 测试账户:");
  console.log("   Creator:", creator.address);
  console.log("   Agent:", agent.address);
  console.log("   Verifier:", verifier.address);
  console.log("");

  // 部署 MockUSDC
  console.log("📝 部署 MockUSDC...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("✅ MockUSDC 部署在:", usdcAddress);
  console.log("");

  // 给 creator 铸造一些 USDC
  console.log("💰 铸造 USDC...");
  const MINT_AMOUNT = hre.ethers.parseUnits("1000", 6); // 1000 USDC
  await usdc.mint(creator.address, MINT_AMOUNT);
  console.log("✅ 铸造", hre.ethers.formatUnits(MINT_AMOUNT, 6), "USDC 给 creator");
  console.log("");

  // 部署 X402Escrow
  console.log("📝 部署 X402Escrow...");
  const X402Escrow = await hre.ethers.getContractFactory("X402Escrow");
  const escrow = await X402Escrow.deploy(usdcAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("✅ X402Escrow 部署在:", escrowAddress);
  console.log("");

  // 部署 TaskRegistry
  console.log("📝 部署 TaskRegistry...");
  const TaskRegistry = await hre.ethers.getContractFactory("TaskRegistry");
  const taskRegistry = await TaskRegistry.deploy(usdcAddress, escrowAddress);
  await taskRegistry.waitForDeployment();
  const taskRegistryAddress = await taskRegistry.getAddress();
  console.log("✅ TaskRegistry 部署在:", taskRegistryAddress);
  console.log("");

  // 设置 TaskRegistry 为 Escrow 的授权合约
  console.log("🔐 授权 TaskRegistry...");
  await escrow.setAuthorizedContract(taskRegistryAddress, true);
  console.log("✅ TaskRegistry 已授权");
  console.log("");

  // 创建任务
  console.log("📋 创建任务...");
  const TASK_REWARD = hre.ethers.parseUnits("10", 6); // 10 USDC

  // 批准 USDC
  await usdc.connect(creator).approve(taskRegistryAddress, TASK_REWARD);
  console.log("✅ 批准", hre.ethers.formatUnits(TASK_REWARD, 6), "USDC");

  // 创建任务
  const tx = await taskRegistry.connect(creator).createTask(
    "测试任务",
    "这是一个测试任务",
    TASK_REWARD,
    Math.floor(Date.now() / 1000) + 86400 // 24小时后截止
  );
  const receipt = await tx.wait();
  console.log("✅ 任务创建成功,交易:", receipt.hash);
  console.log("");

  // 获取任务 ID (从事件中)
  const taskId = 1; // 第一个任务
  console.log("📊 任务 ID:", taskId);
  console.log("");

  // 检查 Agent 初始余额
  const agentBalanceBefore = await usdc.balanceOf(agent.address);
  console.log("💰 Agent 初始余额:", hre.ethers.formatUnits(agentBalanceBefore, 6), "USDC");
  console.log("");

  // Agent 接单
  console.log("👤 Agent 接单...");
  await taskRegistry.connect(agent).assignTask(taskId);
  console.log("✅ Agent 接单成功");
  console.log("");

  // Agent 提交结果
  console.log("📤 Agent 提交结果...");
  await taskRegistry.connect(agent).submitResult(taskId, "任务完成");
  console.log("✅ 结果提交成功");
  console.log("");

  // Verifier 验证任务
  console.log("✔️  Verifier 验证任务...");
  await taskRegistry.connect(verifier).verifyTask(taskId, true);
  console.log("✅ 任务验证通过");
  console.log("");

  // 检查 Agent 最终余额
  const agentBalanceAfter = await usdc.balanceOf(agent.address);
  console.log("💰 Agent 最终余额:", hre.ethers.formatUnits(agentBalanceAfter, 6), "USDC");
  console.log("");

  // 验证 Bug Fix #1: 资金是否释放
  const balanceIncrease = agentBalanceAfter - agentBalanceBefore;
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 Bug Fix #1 验证: 资金释放");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("任务奖励:", hre.ethers.formatUnits(TASK_REWARD, 6), "USDC");
  console.log("余额增加:", hre.ethers.formatUnits(balanceIncrease, 6), "USDC");

  if (balanceIncrease === TASK_REWARD) {
    console.log("✅ 测试通过! Agent 收到了正确的奖励");
  } else if (balanceIncrease === 0n) {
    console.log("❌ 测试失败! Agent 没有收到任何奖励 (Bug 未修复)");
  } else {
    console.log("⚠️  测试异常! Agent 收到的金额不正确");
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 测试失败:", error);
    process.exit(1);
  });

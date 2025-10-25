const hre = require("hardhat");

/**
 * Task402 部署脚本
 * 部署顺序：X402Escrow -> TaskRegistry
 */
async function main() {
  console.log("🚀 开始部署 Task402 智能合约...");
  console.log("网络:", hre.network.name);

  const [deployer] = await hre.ethers.getSigners();
  console.log("部署账户:", deployer.address);
  console.log("账户余额:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

  // ============ 配置参数 ============
  const PLATFORM_ADDRESS = process.env.PLATFORM_ADDRESS || deployer.address;
  const VERIFIER_ADDRESS = process.env.VERIFIER_ADDRESS || deployer.address;
  const PLATFORM_FEE_RATE = 500;  // 5%
  const VERIFIER_FEE_RATE = 500;  // 5%

  console.log("\n配置参数:");
  console.log("- 平台地址:", PLATFORM_ADDRESS);
  console.log("- 验证节点地址:", VERIFIER_ADDRESS);
  console.log("- 平台费率:", PLATFORM_FEE_RATE / 100, "%");
  console.log("- 验证节点费率:", VERIFIER_FEE_RATE / 100, "%");

  // ============ 1. 部署 X402Escrow ============
  console.log("\n📦 部署 X402Escrow...");
  const X402Escrow = await hre.ethers.getContractFactory("X402Escrow");
  const escrow = await X402Escrow.deploy(
    PLATFORM_ADDRESS,
    VERIFIER_ADDRESS,
    PLATFORM_FEE_RATE,
    VERIFIER_FEE_RATE
  );

  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("✅ X402Escrow 部署成功:", escrowAddress);

  // ============ 2. 部署 TaskRegistry ============
  console.log("\n📦 部署 TaskRegistry...");
  const TaskRegistry = await hre.ethers.getContractFactory("TaskRegistry");
  const taskRegistry = await TaskRegistry.deploy(
    escrowAddress,
    VERIFIER_ADDRESS
  );

  await taskRegistry.waitForDeployment();
  const taskRegistryAddress = await taskRegistry.getAddress();
  console.log("✅ TaskRegistry 部署成功:", taskRegistryAddress);

  // ============ 验证部署 ============
  console.log("\n🔍 验证合约状态...");

  const platformAddr = await escrow.platformAddress();
  const verifierAddr = await escrow.verifierAddress();
  const platformFee = await escrow.platformFeeRate();
  const verifierFee = await escrow.verifierFeeRate();

  console.log("X402Escrow 状态:");
  console.log("- 平台地址:", platformAddr);
  console.log("- 验证节点:", verifierAddr);
  console.log("- 平台费率:", platformFee.toString());
  console.log("- 验证节点费率:", verifierFee.toString());

  const totalTasks = await taskRegistry.getTotalTasks();
  const escrowInRegistry = await taskRegistry.escrow();
  const verifierInRegistry = await taskRegistry.verifierNode();

  console.log("\nTaskRegistry 状态:");
  console.log("- Escrow 地址:", escrowInRegistry);
  console.log("- 验证节点:", verifierInRegistry);
  console.log("- 当前任务数:", totalTasks.toString());

  // ============ 保存部署信息 ============
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      X402Escrow: {
        address: escrowAddress,
        platformAddress: PLATFORM_ADDRESS,
        verifierAddress: VERIFIER_ADDRESS,
        platformFeeRate: PLATFORM_FEE_RATE,
        verifierFeeRate: VERIFIER_FEE_RATE
      },
      TaskRegistry: {
        address: taskRegistryAddress,
        escrow: escrowAddress,
        verifier: VERIFIER_ADDRESS
      }
    }
  };

  const fs = require("fs");
  const path = require("path");
  const outputPath = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);

  // 创建目录
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 部署信息已保存:", outputPath);

  // ============ 验证合约（如果在测试网或主网） ============
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n⏳ 等待区块确认后验证合约...");
    console.log("请稍后手动运行以下命令验证合约:");
    console.log(`\nnpx hardhat verify --network ${hre.network.name} ${escrowAddress} ${PLATFORM_ADDRESS} ${VERIFIER_ADDRESS} ${PLATFORM_FEE_RATE} ${VERIFIER_FEE_RATE}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${taskRegistryAddress} ${escrowAddress} ${VERIFIER_ADDRESS}`);
  }

  console.log("\n✨ 部署完成！");
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 合约地址汇总:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("X402Escrow:    ", escrowAddress);
  console.log("TaskRegistry:  ", taskRegistryAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 部署失败:", error);
    process.exit(1);
  });

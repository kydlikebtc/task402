// 本地部署脚本 - 部署所有合约到本地网络并导出 ABI
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 开始部署合约到本地网络...\n");

  const [deployer, agent, verifier] = await hre.ethers.getSigners();
  console.log("✅ 部署账户:", deployer.address);
  console.log("");

  // 1. 部署 MockUSDC
  console.log("📝 部署 MockUSDC...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy("USD Coin", "USDC");
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("✅ MockUSDC:", usdcAddress);

  // 2. 部署 X402Escrow
  console.log("📝 部署 X402Escrow...");
  const X402Escrow = await hre.ethers.getContractFactory("X402Escrow");
  const escrow = await X402Escrow.deploy(
    deployer.address,  // platformAddress
    verifier.address,  // verifierAddress
    150,  // platformFeeRate (1.5%)
    50    // verifierFeeRate (0.5%)
  );
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("✅ X402Escrow:", escrowAddress);

  // 3. 部署 TaskRegistry
  console.log("📝 部署 TaskRegistry...");
  const TaskRegistry = await hre.ethers.getContractFactory("TaskRegistry");
  const taskRegistry = await TaskRegistry.deploy(
    escrowAddress,
    verifier.address,
    deployer.address,
    usdcAddress
  );
  await taskRegistry.waitForDeployment();
  const taskRegistryAddress = await taskRegistry.getAddress();
  console.log("✅ TaskRegistry:", taskRegistryAddress);

  // 4. 授权 TaskRegistry 调用 Escrow
  console.log("📝 授权 TaskRegistry...");
  await escrow.setAuthorizedContract(taskRegistryAddress, true);
  console.log("✅ TaskRegistry 已被授权");
  console.log("");

  // 5. 铸造一些测试 USDC
  console.log("💰 铸造测试 USDC...");
  const MINT_AMOUNT = hre.ethers.parseUnits("10000", 6);
  await usdc.mint(deployer.address, MINT_AMOUNT);
  console.log("✅ 铸造", hre.ethers.formatUnits(MINT_AMOUNT, 6), "USDC 给部署者");
  console.log("");

  // 6. 导出合约地址
  const deploymentInfo = {
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    contracts: {
      MockUSDC: usdcAddress,
      X402Escrow: escrowAddress,
      TaskRegistry: taskRegistryAddress,
    },
    deployer: deployer.address,
    verifier: verifier.address,
    deployedAt: new Date().toISOString(),
  };

  const deploymentPath = path.join(__dirname, "../deployments/local.json");
  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ 合约地址已保存到:", deploymentPath);
  console.log("");

  // 7. 导出 ABI 到前端
  console.log("📦 导出 ABI 到前端...");
  const frontendAbiPath = path.join(__dirname, "../../../app/lib/abis");
  fs.mkdirSync(frontendAbiPath, { recursive: true });

  // 读取编译后的 ABI
  const artifactsPath = path.join(__dirname, "../artifacts/contracts");

  // TaskRegistry ABI
  const taskRegistryArtifact = JSON.parse(
    fs.readFileSync(path.join(artifactsPath, "TaskRegistry.sol/TaskRegistry.json"))
  );
  fs.writeFileSync(
    path.join(frontendAbiPath, "TaskRegistry.json"),
    JSON.stringify(taskRegistryArtifact.abi, null, 2)
  );

  // X402Escrow ABI
  const escrowArtifact = JSON.parse(
    fs.readFileSync(path.join(artifactsPath, "X402Escrow.sol/X402Escrow.json"))
  );
  fs.writeFileSync(
    path.join(frontendAbiPath, "X402Escrow.json"),
    JSON.stringify(escrowArtifact.abi, null, 2)
  );

  // MockUSDC ABI
  const usdcArtifact = JSON.parse(
    fs.readFileSync(path.join(artifactsPath, "mocks/MockUSDC.sol/MockUSDC.json"))
  );
  fs.writeFileSync(
    path.join(frontendAbiPath, "USDC.json"),
    JSON.stringify(usdcArtifact.abi, null, 2)
  );

  console.log("✅ ABI 已导出到:", frontendAbiPath);
  console.log("");

  // 8. 创建前端配置文件
  const frontendConfig = {
    chainId: parseInt(deploymentInfo.chainId),
    chainName: "Hardhat Local",
    rpcUrl: "http://127.0.0.1:8545",
    contracts: {
      taskRegistry: taskRegistryAddress,
      escrow: escrowAddress,
      usdc: usdcAddress,
    },
    accounts: {
      deployer: deployer.address,
      verifier: verifier.address,
    },
  };

  const configPath = path.join(__dirname, "../../../app/lib/config.json");
  fs.writeFileSync(configPath, JSON.stringify(frontendConfig, null, 2));
  console.log("✅ 前端配置已保存到:", configPath);
  console.log("");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 部署完成!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 合约地址:");
  console.log("   MockUSDC:", usdcAddress);
  console.log("   X402Escrow:", escrowAddress);
  console.log("   TaskRegistry:", taskRegistryAddress);
  console.log("");
  console.log("📖 使用指南:");
  console.log("   1. 前端配置已自动更新");
  console.log("   2. 在前端目录运行: npm run dev");
  console.log("   3. 访问: http://localhost:3000");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 部署失败:", error);
    process.exit(1);
  });

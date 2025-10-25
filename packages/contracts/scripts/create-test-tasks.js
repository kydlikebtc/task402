const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 开始创建测试任务...\n");

  // 读取配置
  const configPath = path.join(__dirname, "../../../app/lib/config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  // 获取合约实例
  const USDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await USDC.attach(config.contracts.usdc);

  const TaskRegistry = await ethers.getContractFactory("TaskRegistry");
  const registry = await TaskRegistry.attach(config.contracts.taskRegistry);

  // 获取账户
  const [creator] = await ethers.getSigners();
  console.log("✅ 使用账户:", creator.address);

  // 给 creator 铸造 USDC
  const mintAmount = ethers.parseUnits("1000", 6);
  await usdc.mint(creator.address, mintAmount);
  console.log("✅ 铸造 1000 USDC 给 creator\n");

  // 创建任务数据
  const tasks = [
    {
      description: "分析过去30天的DeFi协议TVL数据并生成可视化报告",
      reward: "50",
      deadline: 7,  // 7天后
      category: 0,  // 数据分析
      name: "数据分析"
    },
    {
      description: "编写一篇关于Layer 2扩容方案的技术文章(3000字以上)",
      reward: "100",
      deadline: 14,
      category: 1,  // 内容创作
      name: "内容创作"
    },
    {
      description: "开发一个ERC-20代币质押合约,包含奖励分配功能",
      reward: "200",
      deadline: 21,
      category: 2,  // 代码开发
      name: "代码开发"
    },
    {
      description: "研究并撰写关于Account Abstraction (EIP-4337)的详细报告",
      reward: "150",
      deadline: 10,
      category: 3,  // 研究报告
      name: "研究报告"
    },
    {
      description: "测试任务 - 验证智能合约功能",
      reward: "10",
      deadline: 3,
      category: 4,  // 其他
      name: "测试任务"
    }
  ];

  // 创建任务
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const reward = ethers.parseUnits(task.reward, 6);
    const deadline = Math.floor(Date.now() / 1000) + 86400 * task.deadline;

    // 授权
    await usdc.connect(creator).approve(registry.target, reward);

    // 创建任务
    const tx = await registry.connect(creator).createTask(
      task.description,
      reward,
      deadline,
      task.category
    );
    await tx.wait();

    console.log(`✅ 创建任务 ${i + 2}: ${task.name} (${task.reward} USDC)`);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 测试任务创建完成!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📊 总共创建了 ${tasks.length + 1} 个任务 (包含之前的测试任务)`);
  console.log("🌐 访问前端查看: http://localhost:3000/tasks");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

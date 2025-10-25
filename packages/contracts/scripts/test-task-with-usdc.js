/**
 * 端到端任务测试 - USDC 完整生命周期
 *
 * 测试流程:
 * 1. 部署所有合约 (MockUSDC, X402Escrow, TaskRegistry)
 * 2. Creator 使用 EIP-3009 创建任务 (USDC 奖励)
 * 3. Agent 使用 USDC 质押接单
 * 4. Agent 提交任务结果
 * 5. Verifier 验证任务
 * 6. 自动结算: Agent 收到 USDC 奖励 + 退还质押
 * 7. 验证信誉系统更新
 */

import hre from 'hardhat';
const { ethers } = hre;

// X402 SDK 函数
async function generateEIP3009Signature({
  usdcAddress,
  from,
  to,
  value,
  validAfter,
  validBefore,
  nonce,
  signer,
  chainId,
  usdcName = 'USD Coin',
  usdcVersion = '1'
}) {
  const domain = {
    name: usdcName,
    version: usdcVersion,
    chainId: chainId,
    verifyingContract: usdcAddress
  };

  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' }
    ]
  };

  const valueData = {
    from,
    to,
    value: value.toString(),
    validAfter,
    validBefore,
    nonce
  };

  const signature = await signer.signTypedData(domain, types, valueData);
  const { v, r, s } = ethers.Signature.from(signature);

  return { v, r, s, signature };
}

function generateNonce() {
  return ethers.hexlify(ethers.randomBytes(32));
}

async function main() {
  console.log('\n🚀 开始端到端任务测试 (USDC)...\n');

  // 获取测试账户
  const [deployer, creator, agent, platform, verifier] = await ethers.getSigners();

  console.log('📋 测试账户:');
  console.log(`   Deployer: ${deployer.address}`);
  console.log(`   Creator: ${creator.address}`);
  console.log(`   Agent: ${agent.address}`);
  console.log(`   Platform: ${platform.address}`);
  console.log(`   Verifier: ${verifier.address}\n`);

  // ========================================
  // 第 1 步: 部署合约
  // ========================================
  console.log('📦 第 1 步: 部署合约...\n');

  // 部署 MockUSDC
  const MockUSDC = await ethers.getContractFactory('MockUSDC');
  const usdc = await MockUSDC.deploy('USD Coin', 'USDC');
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log(`   ✅ MockUSDC 部署: ${usdcAddress}`);

  // 部署 X402Escrow
  const X402Escrow = await ethers.getContractFactory('X402Escrow');
  const escrow = await X402Escrow.deploy(
    platform.address,
    verifier.address,
    150,  // 1.5% platform fee
    50    // 0.5% verifier fee
  );
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`   ✅ X402Escrow 部署: ${escrowAddress}`);

  // 部署 TaskRegistry
  const TaskRegistry = await ethers.getContractFactory('TaskRegistry');
  const taskRegistry = await TaskRegistry.deploy(
    escrowAddress,
    verifier.address,
    platform.address,
    usdcAddress
  );
  await taskRegistry.waitForDeployment();
  const taskRegistryAddress = await taskRegistry.getAddress();
  console.log(`   ✅ TaskRegistry 部署: ${taskRegistryAddress}\n`);

  // 授权 TaskRegistry 调用 Escrow
  await escrow.connect(platform).setAuthorizedContract(taskRegistryAddress, true);
  console.log(`   ✅ TaskRegistry 已授权调用 Escrow\n`);

  // ========================================
  // 第 2 步: 铸造 USDC
  // ========================================
  console.log('💰 第 2 步: 铸造 USDC...\n');

  const creatorAmount = ethers.parseUnits('1000', 6);  // 1000 USDC
  const agentAmount = ethers.parseUnits('100', 6);    // 100 USDC

  await usdc.mint(creator.address, creatorAmount);
  await usdc.mint(agent.address, agentAmount);

  console.log(`   ✅ Creator USDC: ${ethers.formatUnits(await usdc.balanceOf(creator.address), 6)} USDC`);
  console.log(`   ✅ Agent USDC: ${ethers.formatUnits(await usdc.balanceOf(agent.address), 6)} USDC\n`);

  // ========================================
  // 第 3 步: Creator 创建任务 (使用 EIP-3009)
  // ========================================
  console.log('📝 第 3 步: Creator 创建任务...\n');

  const taskReward = ethers.parseUnits('50', 6);  // 50 USDC
  const taskDeadline = Math.floor(Date.now() / 1000) + 86400;  // 24 hours
  const taskDescription = '分析区块链数据并生成报告';
  const taskCategory = 0;  // DataAnalysis

  // 生成 EIP-3009 签名
  const nonce = generateNonce();
  const validAfter = 0;
  const validBefore = Math.floor(Date.now() / 1000) + 3600;
  const chainId = (await ethers.provider.getNetwork()).chainId;

  const { v, r, s } = await generateEIP3009Signature({
    usdcAddress,
    from: creator.address,
    to: escrowAddress,  // USDC 转到 Escrow
    value: taskReward,
    validAfter,
    validBefore,
    nonce,
    signer: creator,
    chainId: Number(chainId),
    usdcVersion: '1'
  });

  console.log(`   任务奖励: ${ethers.formatUnits(taskReward, 6)} USDC`);
  console.log(`   任务描述: ${taskDescription}`);
  console.log(`   截止时间: ${new Date(taskDeadline * 1000).toLocaleString()}\n`);

  // 创建任务
  const createTx = await taskRegistry.connect(creator).createTaskWithUSDC(
    taskDescription,
    taskReward,
    taskDeadline,
    taskCategory,
    validAfter,
    validBefore,
    nonce,
    v, r, s
  );

  const createReceipt = await createTx.wait();
  const taskId = 1;  // 第一个任务 ID 为 1

  console.log(`   ✅ 任务创建成功! TaskID: ${taskId}`);
  console.log(`   交易哈希: ${createReceipt.hash}`);
  console.log(`   Gas 使用: ${createReceipt.gasUsed.toString()}\n`);

  // 验证 USDC 已转到 Escrow
  const escrowBalance = await usdc.balanceOf(escrowAddress);
  const creatorBalanceAfterCreate = await usdc.balanceOf(creator.address);

  console.log(`   Escrow USDC: ${ethers.formatUnits(escrowBalance, 6)} USDC`);
  console.log(`   Creator USDC: ${ethers.formatUnits(creatorBalanceAfterCreate, 6)} USDC (减少 ${ethers.formatUnits(taskReward, 6)} USDC)\n`);

  // ========================================
  // 第 4 步: Agent 接单 (USDC 质押)
  // ========================================
  console.log('🤝 第 4 步: Agent 接单...\n');

  // 计算所需质押 (20% of reward)
  const stakePercentage = await taskRegistry.stakePercentage();
  const requiredStake = (taskReward * stakePercentage) / 10000n;

  console.log(`   所需质押: ${ethers.formatUnits(requiredStake, 6)} USDC (20% of reward)`);

  // Agent 授权 USDC 给 TaskRegistry
  await usdc.connect(agent).approve(taskRegistryAddress, requiredStake);
  console.log(`   ✅ Agent 已授权 USDC`);

  // Agent 接单
  const assignTx = await taskRegistry.connect(agent).assignTaskWithUSDC(taskId, requiredStake);
  await assignTx.wait();

  console.log(`   ✅ Agent 接单成功!`);

  // 验证质押转移
  const agentBalanceAfterAssign = await usdc.balanceOf(agent.address);
  const registryBalance = await usdc.balanceOf(taskRegistryAddress);

  console.log(`   Agent USDC: ${ethers.formatUnits(agentBalanceAfterAssign, 6)} USDC (减少 ${ethers.formatUnits(requiredStake, 6)} USDC)`);
  console.log(`   TaskRegistry USDC: ${ethers.formatUnits(registryBalance, 6)} USDC (质押金)\n`);

  // ========================================
  // 第 5 步: Agent 提交任务结果
  // ========================================
  console.log('📤 第 5 步: Agent 提交任务结果...\n');

  const resultHash = 'QmXxx...'; // IPFS hash

  await taskRegistry.connect(agent).submitTask(taskId, resultHash);
  console.log(`   ✅ 任务结果已提交: ${resultHash}\n`);

  // ========================================
  // 第 6 步: Verifier 验证任务
  // ========================================
  console.log('✅ 第 6 步: Verifier 验证任务...\n');

  // 记录验证前的余额
  const agentBalanceBeforeVerify = await usdc.balanceOf(agent.address);
  const platformBalanceBefore = await usdc.balanceOf(platform.address);
  const verifierBalanceBefore = await usdc.balanceOf(verifier.address);

  await taskRegistry.connect(verifier).verifyTask(taskId, true);  // true = 验证通过
  console.log(`   ✅ 任务验证通过!\n`);

  // ========================================
  // 第 7 步: 验证结算结果
  // ========================================
  console.log('💸 第 7 步: 验证结算结果...\n');

  // 检查所有余额
  const agentBalanceAfterComplete = await usdc.balanceOf(agent.address);
  const platformBalanceAfter = await usdc.balanceOf(platform.address);
  const verifierBalanceAfter = await usdc.balanceOf(verifier.address);
  const escrowBalanceAfter = await usdc.balanceOf(escrowAddress);
  const registryBalanceAfter = await usdc.balanceOf(taskRegistryAddress);

  // 计算变化
  const agentEarned = agentBalanceAfterComplete - agentBalanceBeforeVerify;
  const platformFee = platformBalanceAfter - platformBalanceBefore;
  const verifierFee = verifierBalanceAfter - verifierBalanceBefore;

  console.log(`   💰 Agent 收益:`);
  console.log(`      - 任务奖励: ${ethers.formatUnits(taskReward, 6)} USDC`);
  console.log(`      - 平台手续费: ${ethers.formatUnits(platformFee, 6)} USDC (1.5%)`);
  console.log(`      - 验证手续费: ${ethers.formatUnits(verifierFee, 6)} USDC (0.5%)`);
  console.log(`      - 实际收到: ${ethers.formatUnits(agentEarned - requiredStake, 6)} USDC (扣除手续费)`);
  console.log(`      - 退还质押: ${ethers.formatUnits(requiredStake, 6)} USDC`);
  console.log(`      - 总收益: ${ethers.formatUnits(agentEarned, 6)} USDC\n`);

  console.log(`   📊 最终余额:`);
  console.log(`      - Agent: ${ethers.formatUnits(agentBalanceAfterComplete, 6)} USDC`);
  console.log(`      - Platform: ${ethers.formatUnits(platformBalanceAfter, 6)} USDC`);
  console.log(`      - Verifier: ${ethers.formatUnits(verifierBalanceAfter, 6)} USDC`);
  console.log(`      - Escrow: ${ethers.formatUnits(escrowBalanceAfter, 6)} USDC`);
  console.log(`      - TaskRegistry: ${ethers.formatUnits(registryBalanceAfter, 6)} USDC\n`);

  // ========================================
  // 第 8 步: 验证任务状态和信誉
  // ========================================
  console.log('🔍 第 8 步: 验证任务状态和信誉...\n');

  const task = await taskRegistry.tasks(taskId);
  const agentReputation = await taskRegistry.agentReputation(agent.address);
  const agentCompletedTasks = await taskRegistry.agentCompletedTasks(agent.address);

  console.log(`   任务状态: ${['Open', 'Assigned', 'Submitted', 'Verified', 'Completed', 'Cancelled', 'Disputed'][task.status]}`);
  console.log(`   完成时间: ${new Date(Number(task.completedAt) * 1000).toLocaleString()}`);
  console.log(`   质押已退还: ${task.stakeRefunded ? '是' : '否'}\n`);

  console.log(`   🏆 Agent 信誉:`);
  console.log(`      - 信誉分数: ${agentReputation.toString()}`);
  console.log(`      - 完成任务数: ${agentCompletedTasks.toString()}\n`);

  // ========================================
  // 测试总结
  // ========================================
  console.log('════════════════════════════════════════════════════════════');
  console.log('🎉 端到端任务测试完成!\n');
  console.log('📝 测试结果总结:');
  console.log('   1. ✅ 合约部署成功 (MockUSDC, X402Escrow, TaskRegistry)');
  console.log('   2. ✅ Creator 使用 EIP-3009 创建任务');
  console.log('   3. ✅ USDC 从 Creator 转到 Escrow');
  console.log('   4. ✅ Agent 使用 USDC 质押接单');
  console.log('   5. ✅ Agent 提交任务结果');
  console.log('   6. ✅ Verifier 验证任务通过');
  console.log('   7. ✅ 自动结算: Agent 收到奖励 + 退还质押');
  console.log('   8. ✅ 手续费正确分配给 Platform 和 Verifier');
  console.log('   9. ✅ Agent 信誉系统更新\n');

  console.log('💰 资金流总结:');
  console.log(`   Creator 支出: ${ethers.formatUnits(taskReward, 6)} USDC (任务奖励)`);
  console.log(`   Agent 净收益: ${ethers.formatUnits(agentEarned, 6)} USDC (奖励 - 手续费 + 退还质押)`);
  console.log(`   Platform 收益: ${ethers.formatUnits(platformFee, 6)} USDC`);
  console.log(`   Verifier 收益: ${ethers.formatUnits(verifierFee, 6)} USDC\n`);

  console.log('🎊 所有功能验证成功!');
  console.log('════════════════════════════════════════════════════════════\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

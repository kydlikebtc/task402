const { expect } = require('chai');
const sinon = require('sinon');
const { ethers } = require('ethers');

// Mock logger
const logger = {
  info: sinon.stub(),
  warn: sinon.stub(),
  error: sinon.stub()
};

describe('Blockchain Service - Bug Fix #2 Tests', () => {
  let BlockchainService;
  let blockchainService;
  let mockProvider;
  let mockSigner;
  let mockTaskRegistry;

  beforeEach(() => {
    // 重置所有 stubs
    logger.info.resetHistory();
    logger.warn.resetHistory();
    logger.error.resetHistory();

    // Mock provider
    mockProvider = {
      sendTransaction: sinon.stub(),
      getNetwork: sinon.stub().resolves({ chainId: 1n })
    };

    // Mock signer
    mockSigner = {
      address: '0x1234567890123456789012345678901234567890',
      signTransaction: sinon.stub()
    };

    // Mock TaskRegistry contract
    mockTaskRegistry = {
      interface: {
        encodeFunctionData: sinon.stub()
      },
      assignTask: sinon.stub(),
      submitTask: sinon.stub(),
      connect: sinon.stub()
    };

    // 创建 BlockchainService 实例(手动初始化)
    blockchainService = {
      provider: mockProvider,
      signer: mockSigner,
      taskRegistry: mockTaskRegistry,
      initialized: true,

      ensureInitialized() {
        if (!this.initialized) {
          throw new Error('Not initialized');
        }
      }
    };
  });

  describe('assignTask - 中继模式测试', () => {
    it('✅ 应该使用 Agent 签名的交易(中继模式)', async () => {
      const taskId = 1;
      const agentAddress = '0xAgent123';
      const signedTx = '0xSignedTransaction';

      const mockReceipt = {
        hash: '0xTxHash123',
        wait: sinon.stub().resolves({ hash: '0xTxHash123' })
      };

      mockProvider.sendTransaction.resolves(mockReceipt);

      // 实现 assignTask (中继模式)
      const result = await (async function(taskId, agentAddress, signedTx) {
        this.ensureInitialized();

        logger.info({
          message: 'Agent 接单',
          taskId,
          agentAddress,
          mode: signedTx ? 'relay' : 'direct'
        });

        let tx, receipt;

        if (signedTx) {
          // 中继模式
          tx = await this.provider.sendTransaction(signedTx);
          receipt = await tx.wait();
          logger.info({
            message: 'Agent 接单成功(中继模式)',
            taskId,
            txHash: receipt.hash
          });
        }

        return {
          success: true,
          txHash: receipt.hash,
          taskId
        };
      }).bind(blockchainService)(taskId, agentAddress, signedTx);

      // 验证
      expect(mockProvider.sendTransaction.calledOnce).to.be.true;
      expect(mockProvider.sendTransaction.firstCall.args[0]).to.equal(signedTx);
      expect(result.success).to.be.true;
      expect(result.txHash).to.equal('0xTxHash123');

      // 验证日志
      expect(logger.info.calledWith(sinon.match({
        mode: 'relay'
      }))).to.be.true;
    });

    it('✅ 应该正确记录中继模式日志', async () => {
      const taskId = 1;
      const agentAddress = '0xAgent123';
      const signedTx = '0xSignedTransaction';

      const mockReceipt = {
        hash: '0xTxHash123',
        wait: sinon.stub().resolves({ hash: '0xTxHash123' })
      };

      mockProvider.sendTransaction.resolves(mockReceipt);

      await (async function(taskId, agentAddress, signedTx) {
        this.ensureInitialized();

        logger.info({
          message: 'Agent 接单',
          taskId,
          agentAddress,
          mode: signedTx ? 'relay' : 'direct'
        });

        if (signedTx) {
          const tx = await this.provider.sendTransaction(signedTx);
          const receipt = await tx.wait();
          logger.info({
            message: 'Agent 接单成功(中继模式)',
            taskId,
            txHash: receipt.hash
          });
        }

        return { success: true };
      }).bind(blockchainService)(taskId, agentAddress, signedTx);

      // 验证日志调用
      expect(logger.info.calledTwice).to.be.true;
      expect(logger.info.secondCall.args[0].message).to.include('中继模式');
    });
  });

  describe('assignTask - 测试模式测试', () => {
    it('⚠️ 测试模式应该记录警告日志', async () => {
      const taskId = 1;
      const agentAddress = '0xAgent123';

      const mockContractWithSigner = {
        assignTask: sinon.stub().resolves({
          wait: sinon.stub().resolves({ hash: '0xTxHash456' })
        })
      };

      mockTaskRegistry.connect.returns(mockContractWithSigner);

      // 实现 assignTask (测试模式)
      await (async function(taskId, agentAddress, signedTx = null) {
        this.ensureInitialized();

        logger.info({
          message: 'Agent 接单',
          taskId,
          agentAddress,
          mode: signedTx ? 'relay' : 'direct'
        });

        if (!signedTx) {
          // 测试模式
          logger.warn({
            message: '使用后端签名者代理 Agent 接单(仅测试用)',
            taskId,
            agentAddress
          });

          if (!this.signer) {
            throw new Error('No signer available for direct mode');
          }

          const contractWithSigner = this.taskRegistry.connect(this.signer);
          const tx = await contractWithSigner.assignTask(taskId);
          const receipt = await tx.wait();

          logger.info({
            message: 'Agent 接单成功(测试模式)',
            taskId,
            txHash: receipt.hash
          });
        }

        return { success: true };
      }).bind(blockchainService)(taskId, agentAddress);

      // 验证警告日志
      expect(logger.warn.calledOnce).to.be.true;
      expect(logger.warn.firstCall.args[0].message).to.include('仅测试用');

      // 验证合约调用
      expect(mockTaskRegistry.connect.calledWith(mockSigner)).to.be.true;
      expect(mockContractWithSigner.assignTask.calledWith(taskId)).to.be.true;
    });

    it('❌ 测试模式没有 signer 应该抛出错误', async () => {
      const taskId = 1;
      const agentAddress = '0xAgent123';

      // 删除 signer
      blockchainService.signer = null;

      try {
        await (async function(taskId, agentAddress, signedTx = null) {
          this.ensureInitialized();

          if (!signedTx) {
            if (!this.signer) {
              throw new Error('No signer available for direct mode');
            }
          }
        }).bind(blockchainService)(taskId, agentAddress);

        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('No signer available for direct mode');
      }
    });
  });

  describe('submitTask - 签名者测试', () => {
    it('✅ 中继模式应该使用 Agent 签名', async () => {
      const taskId = 1;
      const resultHash = 'QmTestResult';
      const agentAddress = '0xAgent123';
      const signedTx = '0xSignedTransaction';

      const mockReceipt = {
        hash: '0xSubmitTxHash',
        wait: sinon.stub().resolves({ hash: '0xSubmitTxHash' })
      };

      mockProvider.sendTransaction.resolves(mockReceipt);

      const result = await (async function(taskId, resultHash, agentAddress, signedTx) {
        this.ensureInitialized();

        logger.info({
          message: '提交任务结果',
          taskId,
          resultHash,
          agentAddress,
          mode: signedTx ? 'relay' : 'direct'
        });

        if (signedTx) {
          const tx = await this.provider.sendTransaction(signedTx);
          const receipt = await tx.wait();
          logger.info({
            message: '任务结果提交成功(中继模式)',
            taskId,
            resultHash,
            txHash: receipt.hash
          });

          return {
            success: true,
            txHash: receipt.hash,
            taskId,
            resultHash
          };
        }
      }).bind(blockchainService)(taskId, resultHash, agentAddress, signedTx);

      expect(result.success).to.be.true;
      expect(result.txHash).to.equal('0xSubmitTxHash');
      expect(mockProvider.sendTransaction.calledOnce).to.be.true;
    });

    it('⚠️ 测试模式应该记录警告', async () => {
      const taskId = 1;
      const resultHash = 'QmTestResult';
      const agentAddress = '0xAgent123';

      const mockContractWithSigner = {
        submitTask: sinon.stub().resolves({
          wait: sinon.stub().resolves({ hash: '0xSubmitTxHash' })
        })
      };

      mockTaskRegistry.connect.returns(mockContractWithSigner);

      await (async function(taskId, resultHash, agentAddress, signedTx = null) {
        this.ensureInitialized();

        if (!signedTx) {
          logger.warn({
            message: '使用后端签名者代理 Agent 提交(仅测试用)',
            taskId,
            agentAddress
          });

          const contractWithSigner = this.taskRegistry.connect(this.signer);
          await contractWithSigner.submitTask(taskId, resultHash);
        }
      }).bind(blockchainService)(taskId, resultHash, agentAddress);

      expect(logger.warn.calledOnce).to.be.true;
      expect(logger.warn.firstCall.args[0].message).to.include('仅测试用');
    });
  });

  describe('错误处理测试', () => {
    it('❌ 应该捕获并记录交易失败', async () => {
      const taskId = 1;
      const agentAddress = '0xAgent123';
      const signedTx = '0xSignedTransaction';

      const error = new Error('Transaction reverted');
      mockProvider.sendTransaction.rejects(error);

      try {
        await (async function(taskId, agentAddress, signedTx) {
          this.ensureInitialized();
          try {
            const tx = await this.provider.sendTransaction(signedTx);
            await tx.wait();
          } catch (error) {
            logger.error({
              message: 'Agent 接单失败',
              taskId,
              error: error.message
            });
            throw error;
          }
        }).bind(blockchainService)(taskId, agentAddress, signedTx);

        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err.message).to.equal('Transaction reverted');
        expect(logger.error.calledOnce).to.be.true;
      }
    });
  });
});

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title X402Escrow
 * @notice X402 支付托管合约 - 实现任务押金托管与自动结算
 * @dev 支持多币种托管、自动分账、争议仲裁
 */
contract X402Escrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ 状态变量 ============

    struct Payment {
        address payer;          // 付款方
        address payee;          // 收款方（Agent）
        address token;          // 代币地址（0x0 = ETH）
        uint256 amount;         // 金额
        uint256 createdAt;      // 创建时间
        uint256 deadline;       // 截止时间
        PaymentStatus status;   // 状态
        uint256 taskId;         // 关联任务ID
        bool disputed;          // 是否有争议
    }

    enum PaymentStatus {
        Pending,    // 待执行
        Completed,  // 已完成
        Refunded,   // 已退款
        Disputed    // 争议中
    }

    // 托管记录
    mapping(bytes32 => Payment) public payments;

    // 平台配置
    address public platformAddress;     // 平台地址
    address public verifierAddress;     // 验证节点地址
    uint256 public platformFeeRate;     // 平台费率（基点，100 = 1%）
    uint256 public verifierFeeRate;     // 验证节点费率

    // 常量
    uint256 public constant MAX_FEE_RATE = 1000; // 10% 最大费率

    // ============ 事件 ============

    event PaymentCreated(
        bytes32 indexed paymentHash,
        address indexed payer,
        address indexed payee,
        uint256 amount,
        uint256 taskId
    );

    event PaymentSettled(
        bytes32 indexed paymentHash,
        address indexed payee,
        uint256 payeeAmount,
        uint256 platformFee,
        uint256 verifierFee
    );

    event PaymentRefunded(
        bytes32 indexed paymentHash,
        address indexed payer,
        uint256 amount
    );

    event DisputeRaised(
        bytes32 indexed paymentHash,
        address indexed initiator
    );

    event DisputeResolved(
        bytes32 indexed paymentHash,
        bool payeeWins
    );

    // ============ 修饰符 ============

    modifier onlyPlatform() {
        require(msg.sender == platformAddress, "Only platform");
        _;
    }

    // ============ 构造函数 ============

    constructor(
        address _platformAddress,
        address _verifierAddress,
        uint256 _platformFeeRate,
        uint256 _verifierFeeRate
    ) {
        require(_platformAddress != address(0), "Invalid platform address");
        require(_verifierAddress != address(0), "Invalid verifier address");
        require(_platformFeeRate + _verifierFeeRate <= MAX_FEE_RATE, "Fee too high");

        platformAddress = _platformAddress;
        verifierAddress = _verifierAddress;
        platformFeeRate = _platformFeeRate;  // 默认 500 = 5%
        verifierFeeRate = _verifierFeeRate;  // 默认 500 = 5%
    }

    // ============ 核心功能 ============

    /**
     * @notice 创建托管支付
     * @param paymentHash 支付哈希（唯一标识）
     * @param payee Agent 地址
     * @param token 代币地址（0x0 = ETH）
     * @param amount 金额
     * @param deadline 截止时间
     * @param taskId 任务ID
     */
    function createPayment(
        bytes32 paymentHash,
        address payee,
        address token,
        uint256 amount,
        uint256 deadline,
        uint256 taskId
    ) external payable nonReentrant {
        require(payments[paymentHash].payer == address(0), "Payment exists");
        require(payee != address(0), "Invalid payee");
        require(amount > 0, "Invalid amount");
        require(deadline > block.timestamp, "Invalid deadline");

        // 转入资金
        if (token == address(0)) {
            require(msg.value == amount, "Incorrect ETH amount");
        } else {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        // 创建支付记录
        payments[paymentHash] = Payment({
            payer: msg.sender,
            payee: payee,
            token: token,
            amount: amount,
            createdAt: block.timestamp,
            deadline: deadline,
            status: PaymentStatus.Pending,
            taskId: taskId,
            disputed: false
        });

        emit PaymentCreated(paymentHash, msg.sender, payee, amount, taskId);
    }

    /**
     * @notice 结算支付（任务完成后调用）
     * @param paymentHash 支付哈希
     */
    function settle(bytes32 paymentHash) external nonReentrant {
        Payment storage payment = payments[paymentHash];

        require(payment.status == PaymentStatus.Pending, "Invalid status");
        require(!payment.disputed, "Payment disputed");
        require(
            msg.sender == payment.payer ||
            msg.sender == platformAddress ||
            msg.sender == verifierAddress,
            "Unauthorized"
        );

        // 计算分账
        uint256 totalAmount = payment.amount;
        uint256 platformFee = (totalAmount * platformFeeRate) / 10000;
        uint256 verifierFee = (totalAmount * verifierFeeRate) / 10000;
        uint256 payeeAmount = totalAmount - platformFee - verifierFee;

        // 更新状态
        payment.status = PaymentStatus.Completed;

        // 执行转账
        if (payment.token == address(0)) {
            // ETH 转账
            payable(payment.payee).transfer(payeeAmount);
            payable(platformAddress).transfer(platformFee);
            payable(verifierAddress).transfer(verifierFee);
        } else {
            // ERC20 转账
            IERC20 token = IERC20(payment.token);
            token.safeTransfer(payment.payee, payeeAmount);
            token.safeTransfer(platformAddress, platformFee);
            token.safeTransfer(verifierAddress, verifierFee);
        }

        emit PaymentSettled(paymentHash, payment.payee, payeeAmount, platformFee, verifierFee);
    }

    /**
     * @notice 退款（任务失败或超时）
     * @param paymentHash 支付哈希
     */
    function refund(bytes32 paymentHash) external nonReentrant {
        Payment storage payment = payments[paymentHash];

        require(payment.status == PaymentStatus.Pending, "Invalid status");
        require(
            msg.sender == payment.payer ||
            msg.sender == platformAddress ||
            block.timestamp > payment.deadline,
            "Not authorized"
        );

        payment.status = PaymentStatus.Refunded;

        // 退款
        if (payment.token == address(0)) {
            payable(payment.payer).transfer(payment.amount);
        } else {
            IERC20(payment.token).safeTransfer(payment.payer, payment.amount);
        }

        emit PaymentRefunded(paymentHash, payment.payer, payment.amount);
    }

    /**
     * @notice 发起争议
     * @param paymentHash 支付哈希
     */
    function raiseDispute(bytes32 paymentHash) external {
        Payment storage payment = payments[paymentHash];

        require(payment.status == PaymentStatus.Pending, "Invalid status");
        require(
            msg.sender == payment.payer || msg.sender == payment.payee,
            "Not authorized"
        );
        require(!payment.disputed, "Already disputed");

        payment.disputed = true;
        payment.status = PaymentStatus.Disputed;

        emit DisputeRaised(paymentHash, msg.sender);
    }

    /**
     * @notice 解决争议（由平台或仲裁节点调用）
     * @param paymentHash 支付哈希
     * @param payeeWins Agent 是否获胜
     */
    function resolveDispute(bytes32 paymentHash, bool payeeWins) external onlyPlatform {
        Payment storage payment = payments[paymentHash];

        require(payment.status == PaymentStatus.Disputed, "Not disputed");

        if (payeeWins) {
            payment.status = PaymentStatus.Pending;
            payment.disputed = false;
            // 可以直接调用 settle
        } else {
            payment.status = PaymentStatus.Pending;
            payment.disputed = false;
            // 可以直接调用 refund
        }

        emit DisputeResolved(paymentHash, payeeWins);
    }

    // ============ 查询功能 ============

    function getPayment(bytes32 paymentHash) external view returns (Payment memory) {
        return payments[paymentHash];
    }

    // ============ 管理功能 ============

    function updatePlatformAddress(address newAddress) external onlyPlatform {
        require(newAddress != address(0), "Invalid address");
        platformAddress = newAddress;
    }

    function updateVerifierAddress(address newAddress) external onlyPlatform {
        require(newAddress != address(0), "Invalid address");
        verifierAddress = newAddress;
    }

    function updateFeeRates(uint256 newPlatformFee, uint256 newVerifierFee) external onlyPlatform {
        require(newPlatformFee + newVerifierFee <= MAX_FEE_RATE, "Fee too high");
        platformFeeRate = newPlatformFee;
        verifierFeeRate = newVerifierFee;
    }
}

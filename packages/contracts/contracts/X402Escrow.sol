// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IUSDC.sol";

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

    // 授权合约（允许调用 settle 的合约，如 TaskRegistry）
    mapping(address => bool) public authorizedContracts;

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

    event AuthorizedContractUpdated(
        address indexed contractAddress,
        bool authorized
    );

    event PayeeUpdated(
        bytes32 indexed paymentHash,
        address indexed oldPayee,
        address indexed newPayee
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
     * @notice 注册外部支付（用于 EIP-3009，资金已转入）
     * @param paymentHash 支付哈希
     * @param payee Agent 地址
     * @param token 代币地址
     * @param amount 金额
     * @param deadline 截止时间
     * @param taskId 任务ID
     * @dev 仅授权合约可调用，用于 EIP-3009 等场景
     */
    function registerExternalPayment(
        bytes32 paymentHash,
        address payer,
        address payee,
        address token,
        uint256 amount,
        uint256 deadline,
        uint256 taskId
    ) external nonReentrant {
        require(authorizedContracts[msg.sender], "Not authorized");
        require(payments[paymentHash].payer == address(0), "Payment exists");
        require(payer != address(0), "Invalid payer");
        require(payee != address(0), "Invalid payee");
        require(amount > 0, "Invalid amount");
        require(deadline > block.timestamp, "Invalid deadline");

        // 创建支付记录（资金已经在 Escrow 中）
        payments[paymentHash] = Payment({
            payer: payer,  // 使用参数传入的 payer
            payee: payee,
            token: token,
            amount: amount,
            createdAt: block.timestamp,
            deadline: deadline,
            status: PaymentStatus.Pending,
            taskId: taskId,
            disputed: false
        });

        emit PaymentCreated(paymentHash, payer, payee, amount, taskId);
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
            msg.sender == verifierAddress ||
            authorizedContracts[msg.sender],  // 允许授权合约调用
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

    /**
     * @notice 设置授权合约
     * @param contractAddress 合约地址
     * @param authorized 是否授权
     * @dev 只有平台可以调用此函数,授权可信合约调用 settle
     */
    function setAuthorizedContract(address contractAddress, bool authorized)
        external
        onlyPlatform
    {
        require(contractAddress != address(0), "Invalid contract address");
        authorizedContracts[contractAddress] = authorized;
        emit AuthorizedContractUpdated(contractAddress, authorized);
    }

    /**
     * @notice 更新支付的收款方地址
     * @param paymentHash 支付哈希
     * @param newPayee 新的收款方地址
     * @dev 只有授权合约(如 TaskRegistry)可以调用,用于在 Agent 接单时更新收款方
     */
    function updatePayee(bytes32 paymentHash, address newPayee)
        external
    {
        require(authorizedContracts[msg.sender], "Not authorized");
        require(newPayee != address(0), "Invalid payee address");

        Payment storage payment = payments[paymentHash];
        require(payment.status == PaymentStatus.Pending, "Payment not pending");

        address oldPayee = payment.payee;
        payment.payee = newPayee;

        emit PayeeUpdated(paymentHash, oldPayee, newPayee);
    }

    function updateFeeRates(uint256 newPlatformFee, uint256 newVerifierFee) external onlyPlatform {
        require(newPlatformFee + newVerifierFee <= MAX_FEE_RATE, "Fee too high");
        platformFeeRate = newPlatformFee;
        verifierFeeRate = newVerifierFee;
    }

    // ============ X402 + EIP-3009 扩展功能 ============

    /**
     * @notice 使用 EIP-3009 签名创建托管支付 (X402 协议)
     * @param paymentHash 支付哈希
     * @param payer Creator 地址
     * @param payee Agent 地址
     * @param usdcAddress USDC 合约地址
     * @param amount USDC 金额
     * @param deadline 截止时间
     * @param taskId 任务ID
     * @param validAfter EIP-3009: 有效起始时间
     * @param validBefore EIP-3009: 有效截止时间
     * @param nonce EIP-3009: 唯一随机数
     * @param v ECDSA 签名参数
     * @param r ECDSA 签名参数
     * @param s ECDSA 签名参数
     * @dev 由 Facilitator 代理执行,Creator 零 Gas
     */
    function createPaymentWithAuthorization(
        bytes32 paymentHash,
        address payer,
        address payee,
        address usdcAddress,
        uint256 amount,
        uint256 deadline,
        uint256 taskId,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        require(payments[paymentHash].payer == address(0), "Payment exists");
        require(payee != address(0), "Invalid payee");
        require(amount > 0, "Invalid amount");
        require(deadline > block.timestamp, "Invalid deadline");

        // 使用 EIP-3009 从 Creator 转账 USDC 到 Escrow
        IUSDC(usdcAddress).transferWithAuthorization(
            payer,           // from: Creator
            address(this),   // to: Escrow
            amount,
            validAfter,
            validBefore,
            nonce,
            v, r, s
        );

        // 创建支付记录
        payments[paymentHash] = Payment({
            payer: payer,
            payee: payee,
            token: usdcAddress,  // USDC 地址
            amount: amount,
            createdAt: block.timestamp,
            deadline: deadline,
            status: PaymentStatus.Pending,
            taskId: taskId,
            disputed: false
        });

        emit PaymentCreated(paymentHash, payer, payee, amount, taskId);
    }
}

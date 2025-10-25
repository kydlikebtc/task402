// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./X402Escrow.sol";

/**
 * @title TaskRegistry
 * @notice 任务注册与管理合约 - 实现任务生命周期管理
 * @dev 每个任务都是一个 NFT，支持自动匹配、执行、验证和结算
 */
contract TaskRegistry is ERC721, ReentrancyGuard {
    // ============ 状态变量 ============

    struct Task {
        uint256 taskId;             // 任务ID
        address creator;            // 创建者
        string description;         // 任务描述
        uint256 reward;             // 奖励金额
        address rewardToken;        // 奖励代币（0x0 = ETH）
        uint256 deadline;           // 截止时间
        TaskStatus status;          // 状态
        address assignedAgent;      // 分配的 Agent
        string resultHash;          // 结果哈希（IPFS）
        bytes32 paymentHash;        // X402 支付哈希
        uint256 createdAt;          // 创建时间
        uint256 completedAt;        // 完成时间
        TaskCategory category;      // 任务分类
    }

    enum TaskStatus {
        Open,           // 开放中
        Assigned,       // 已分配
        Submitted,      // 已提交
        Verified,       // 已验证
        Completed,      // 已完成
        Cancelled,      // 已取消
        Disputed        // 争议中
    }

    enum TaskCategory {
        DataAnalysis,       // 数据分析
        ContentGeneration,  // 内容生成
        CodeReview,         // 代码审查
        Research,           // 研究
        Translation,        // 翻译
        Other              // 其他
    }

    // 任务计数器
    uint256 private _taskIdCounter;

    // 任务存储
    mapping(uint256 => Task) public tasks;

    // Agent 信誉评分
    mapping(address => uint256) public agentReputation;
    mapping(address => uint256) public agentCompletedTasks;

    // X402 托管合约
    X402Escrow public escrow;

    // 验证节点
    address public verifierNode;

    // ============ 事件 ============

    event TaskCreated(
        uint256 indexed taskId,
        address indexed creator,
        uint256 reward,
        TaskCategory category,
        uint256 deadline
    );

    event TaskAssigned(
        uint256 indexed taskId,
        address indexed agent
    );

    event TaskSubmitted(
        uint256 indexed taskId,
        address indexed agent,
        string resultHash
    );

    event TaskVerified(
        uint256 indexed taskId,
        bool approved
    );

    event TaskCompleted(
        uint256 indexed taskId,
        address indexed agent,
        uint256 reward
    );

    event TaskCancelled(
        uint256 indexed taskId
    );

    event ReputationUpdated(
        address indexed agent,
        uint256 newReputation,
        uint256 completedTasks
    );

    // ============ 修饰符 ============

    modifier onlyTaskCreator(uint256 taskId) {
        require(tasks[taskId].creator == msg.sender, "Not task creator");
        _;
    }

    modifier onlyVerifier() {
        require(msg.sender == verifierNode, "Not verifier");
        _;
    }

    modifier taskExists(uint256 taskId) {
        require(tasks[taskId].creator != address(0), "Task not found");
        _;
    }

    // ============ 构造函数 ============

    constructor(address _escrowAddress, address _verifierNode)
        ERC721("Task402 Task NFT", "TASK402")
    {
        require(_escrowAddress != address(0), "Invalid escrow");
        require(_verifierNode != address(0), "Invalid verifier");

        escrow = X402Escrow(_escrowAddress);
        verifierNode = _verifierNode;
    }

    // ============ 核心功能 ============

    /**
     * @notice 创建任务
     * @param description 任务描述
     * @param reward 奖励金额
     * @param rewardToken 奖励代币地址（0x0 = ETH）
     * @param deadline 截止时间戳
     * @param category 任务分类
     */
    function createTask(
        string memory description,
        uint256 reward,
        address rewardToken,
        uint256 deadline,
        TaskCategory category
    ) external payable nonReentrant returns (uint256) {
        require(bytes(description).length > 0, "Empty description");
        require(reward > 0, "Invalid reward");
        require(deadline > block.timestamp, "Invalid deadline");

        // 生成任务ID
        _taskIdCounter++;
        uint256 taskId = _taskIdCounter;

        // 生成支付哈希
        bytes32 paymentHash = keccak256(
            abi.encodePacked(taskId, msg.sender, reward, block.timestamp)
        );

        // 创建 X402 托管
        if (rewardToken == address(0)) {
            require(msg.value == reward, "Incorrect ETH amount");
            escrow.createPayment{value: reward}(
                paymentHash,
                address(this), // 暂时托管给合约
                rewardToken,
                reward,
                deadline,
                taskId
            );
        } else {
            // ERC20 需要先授权
            escrow.createPayment(
                paymentHash,
                address(this),
                rewardToken,
                reward,
                deadline,
                taskId
            );
        }

        // 创建任务
        tasks[taskId] = Task({
            taskId: taskId,
            creator: msg.sender,
            description: description,
            reward: reward,
            rewardToken: rewardToken,
            deadline: deadline,
            status: TaskStatus.Open,
            assignedAgent: address(0),
            resultHash: "",
            paymentHash: paymentHash,
            createdAt: block.timestamp,
            completedAt: 0,
            category: category
        });

        // 铸造任务 NFT
        _safeMint(msg.sender, taskId);

        emit TaskCreated(taskId, msg.sender, reward, category, deadline);

        return taskId;
    }

    /**
     * @notice Agent 接单
     * @param taskId 任务ID
     */
    function assignTask(uint256 taskId) external taskExists(taskId) {
        Task storage task = tasks[taskId];

        require(task.status == TaskStatus.Open, "Task not open");
        require(task.deadline > block.timestamp, "Task expired");
        require(msg.sender != task.creator, "Creator cannot assign");

        task.assignedAgent = msg.sender;
        task.status = TaskStatus.Assigned;

        emit TaskAssigned(taskId, msg.sender);
    }

    /**
     * @notice 提交任务结果
     * @param taskId 任务ID
     * @param resultHash 结果哈希（IPFS CID）
     */
    function submitTask(uint256 taskId, string memory resultHash)
        external
        taskExists(taskId)
    {
        Task storage task = tasks[taskId];

        require(task.status == TaskStatus.Assigned, "Task not assigned");
        require(task.assignedAgent == msg.sender, "Not assigned agent");
        require(bytes(resultHash).length > 0, "Empty result");
        require(task.deadline > block.timestamp, "Task expired");

        task.resultHash = resultHash;
        task.status = TaskStatus.Submitted;

        emit TaskSubmitted(taskId, msg.sender, resultHash);
    }

    /**
     * @notice 验证任务结果（由验证节点调用）
     * @param taskId 任务ID
     * @param approved 是否通过
     */
    function verifyTask(uint256 taskId, bool approved)
        external
        onlyVerifier
        taskExists(taskId)
    {
        Task storage task = tasks[taskId];

        require(task.status == TaskStatus.Submitted, "Task not submitted");

        if (approved) {
            task.status = TaskStatus.Verified;

            // 触发 X402 结算
            _completeTask(taskId);
        } else {
            // 验证失败，重新开放任务
            task.status = TaskStatus.Open;
            task.assignedAgent = address(0);
            task.resultHash = "";
        }

        emit TaskVerified(taskId, approved);
    }

    /**
     * @notice 完成任务并结算
     * @param taskId 任务ID
     */
    function _completeTask(uint256 taskId) internal {
        Task storage task = tasks[taskId];

        require(task.status == TaskStatus.Verified, "Task not verified");
        require(task.assignedAgent != address(0), "No agent assigned");

        // 标记任务为完成状态
        task.status = TaskStatus.Completed;
        task.completedAt = block.timestamp;

        // 通过 X402 Escrow 结算支付给 Agent
        // 释放托管资金给完成任务的 Agent
        escrow.settle(task.paymentHash);

        // 更新 Agent 信誉
        _updateReputation(task.assignedAgent, true);

        emit TaskCompleted(taskId, task.assignedAgent, task.reward);
    }

    /**
     * @notice 取消任务
     * @param taskId 任务ID
     */
    function cancelTask(uint256 taskId)
        external
        onlyTaskCreator(taskId)
        taskExists(taskId)
    {
        Task storage task = tasks[taskId];

        require(
            task.status == TaskStatus.Open || task.status == TaskStatus.Assigned,
            "Cannot cancel"
        );

        task.status = TaskStatus.Cancelled;

        // 触发退款
        escrow.refund(task.paymentHash);

        emit TaskCancelled(taskId);
    }

    /**
     * @notice 更新 Agent 信誉
     * @param agent Agent 地址
     * @param success 是否成功
     */
    function _updateReputation(address agent, bool success) internal {
        if (success) {
            agentCompletedTasks[agent]++;
            agentReputation[agent] += 10; // 每次成功 +10 分
        } else {
            if (agentReputation[agent] >= 5) {
                agentReputation[agent] -= 5; // 失败 -5 分
            }
        }

        emit ReputationUpdated(
            agent,
            agentReputation[agent],
            agentCompletedTasks[agent]
        );
    }

    // ============ 查询功能 ============

    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    function getTotalTasks() external view returns (uint256) {
        return _taskIdCounter;
    }

    function getAgentStats(address agent)
        external
        view
        returns (uint256 reputation, uint256 completedTasks)
    {
        return (agentReputation[agent], agentCompletedTasks[agent]);
    }

    /**
     * @notice 获取开放任务列表（链下索引用）
     */
    function getOpenTasks(uint256 limit)
        external
        view
        returns (uint256[] memory)
    {
        uint256 totalTasks = _taskIdCounter;
        uint256[] memory openTaskIds = new uint256[](limit);
        uint256 count = 0;

        for (uint256 i = 1; i <= totalTasks && count < limit; i++) {
            if (tasks[i].status == TaskStatus.Open) {
                openTaskIds[count] = i;
                count++;
            }
        }

        // 返回实际找到的任务数
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = openTaskIds[i];
        }

        return result;
    }

    // ============ 管理功能 ============

    function updateVerifierNode(address newVerifier) external {
        require(msg.sender == verifierNode, "Not authorized");
        require(newVerifier != address(0), "Invalid address");
        verifierNode = newVerifier;
    }
}

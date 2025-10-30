# X402 产品逻辑流程图

**版本**: 1.0.0
**最后更新**: 2025-10-30
**文档类型**: 产品逻辑可视化

---

## 📑 目录

- [1. 核心业务流程](#1-核心业务流程)
- [2. 零Gas模式详细流程](#2-零gas模式详细流程)
- [3. 任务状态机](#3-任务状态机)
- [4. 资金流转图](#4-资金流转图)
- [5. 系统交互序列图](#5-系统交互序列图)
- [6. 用户角色交互图](#6-用户角色交互图)

---

## 1. 核心业务流程

### 1.1 完整任务生命周期流程图

```mermaid
graph TB
    Start([用户访问 X402]) --> CheckWallet{钱包已连接?}
    CheckWallet -->|否| ConnectWallet[连接 MetaMask]
    CheckWallet -->|是| ChooseRole{选择角色}
    ConnectWallet --> ChooseRole

    ChooseRole -->|Creator| CreateTask[创建任务]
    ChooseRole -->|Worker| BrowseTasks[浏览任务]
    ChooseRole -->|Verifier| VerifyTasks[验证任务]

    %% Creator 流程
    CreateTask --> ChooseMode{选择创建模式}
    ChooseMode -->|标准模式| StandardMode[2次交易<br/>需要 ETH]
    ChooseMode -->|零Gas模式| ZeroGasMode[1次签名<br/>无需 ETH]

    StandardMode --> ApproveUSDC[1. Approve USDC]
    ApproveUSDC --> CallCreate[2. Create Task]
    CallCreate --> TaskCreated[任务创建成功<br/>状态: Open]

    ZeroGasMode --> SignEIP3009[签名 EIP-3009]
    SignEIP3009 --> SendToFacilitator[发送到 Facilitator]
    SendToFacilitator --> FacilitatorProcess[Facilitator 代付 Gas]
    FacilitatorProcess --> TaskCreated

    %% Worker 流程
    BrowseTasks --> FilterTasks[过滤 Open 任务]
    FilterTasks --> SelectTask[选择任务]
    SelectTask --> CheckStake{需要质押?}
    CheckStake -->|是| PayStake[支付质押<br/>20% 奖励]
    CheckStake -->|否| AssignTask[接取任务]
    PayStake --> AssignTask
    AssignTask --> TaskAssigned[任务状态: Assigned]

    TaskAssigned --> WorkOnTask[执行任务]
    WorkOnTask --> UploadIPFS[上传结果到 IPFS]
    UploadIPFS --> SubmitResult[提交 IPFS 哈希]
    SubmitResult --> TaskSubmitted[任务状态: Submitted]

    %% Verifier 流程
    VerifyTasks --> ReviewList[查看待验证列表]
    ReviewList --> DownloadResult[下载 IPFS 结果]
    DownloadResult --> Review[审核质量]
    Review --> Decision{审核结果}

    Decision -->|通过| ApproveTask[verifyTask(true)]
    Decision -->|拒绝| RejectTask[verifyTask(false)]

    ApproveTask --> TaskVerified[任务状态: Verified]
    TaskVerified --> AutoSettle[自动结算]
    AutoSettle --> DistributeFunds[分配资金<br/>Worker 98%<br/>Platform 1.5%<br/>Verifier 0.5%]
    DistributeFunds --> RefundStake[退还质押]
    RefundStake --> TaskCompleted[任务状态: Completed]

    RejectTask --> TaskRejected[任务状态: Rejected]
    TaskRejected --> RetrySubmit{Worker 重新提交?}
    RetrySubmit -->|是| WorkOnTask
    RetrySubmit -->|否| TaskAssigned

    TaskCompleted --> End([流程结束])

    style Start fill:#e1f5ff
    style End fill:#e1f5ff
    style TaskCreated fill:#d4edda
    style TaskAssigned fill:#fff3cd
    style TaskSubmitted fill:#cce5ff
    style TaskVerified fill:#d1ecf1
    style TaskCompleted fill:#d4edda
    style TaskRejected fill:#f8d7da
    style ZeroGasMode fill:#e7d4f7
    style FacilitatorProcess fill:#e7d4f7
```

### 1.2 任务创建模式对比流程

```mermaid
graph LR
    subgraph 标准模式
        S1[用户填写表单] --> S2[点击创建]
        S2 --> S3[MetaMask 弹窗 1:<br/>Approve USDC]
        S3 --> S4[等待确认]
        S4 --> S5[MetaMask 弹窗 2:<br/>Create Task]
        S5 --> S6[等待确认]
        S6 --> S7[任务创建成功]

        S8[Gas 费用: ~$0.05]
        S9[需要 ETH: 是]
        S10[用户操作: 2次交易]
    end

    subgraph 零Gas模式
        Z1[用户填写表单] --> Z2[启用零Gas开关]
        Z2 --> Z3[点击创建]
        Z3 --> Z4[MetaMask 弹窗:<br/>签名授权]
        Z4 --> Z5[发送到 Facilitator]
        Z5 --> Z6[Facilitator 代付 Gas]
        Z6 --> Z7[任务创建成功]

        Z8[Gas 费用: $0]
        Z9[需要 ETH: 否]
        Z10[用户操作: 1次签名]
    end

    style S7 fill:#d4edda
    style Z7 fill:#d4edda
    style Z2 fill:#e7d4f7
    style Z4 fill:#e7d4f7
    style Z6 fill:#e7d4f7
```

---

## 2. 零Gas模式详细流程

### 2.1 EIP-3009 零Gas创建任务流程

```mermaid
sequenceDiagram
    participant C as Creator<br/>(用户)
    participant F as Frontend<br/>(Next.js)
    participant W as MetaMask<br/>(钱包)
    participant FC as Facilitator<br/>(服务器)
    participant TR as TaskRegistry<br/>(合约)
    participant ES as X402Escrow<br/>(合约)
    participant U as USDC<br/>(合约)

    C->>F: 1. 填写任务信息
    C->>F: 2. 启用"零Gas模式"
    C->>F: 3. 点击"创建任务"

    Note over F: 生成 EIP-3009 签名请求
    F->>W: 4. 请求签名<br/>TransferWithAuthorization

    Note over W: 显示签名详情:<br/>from: Creator<br/>to: Escrow<br/>value: 奖励金额<br/>⚠️ 不消耗 Gas

    W->>C: 5. 弹窗确认签名
    C->>W: 6. 确认签名
    W->>F: 7. 返回签名<br/>(v, r, s, nonce)

    Note over F: 构建请求体<br/>包含任务信息和签名

    F->>FC: 8. POST /api/v1/tasks/create<br/>creator, description, reward<br/>signature{v,r,s,nonce}

    Note over FC: 步骤1: 验证签名
    FC->>FC: 9. verifyEIP3009Signature()

    Note over FC: 步骤2: 检查 Gas 价格
    FC->>FC: 10. checkGasPrice()<br/>当前 < 100 gwei?

    Note over FC: 步骤3: 调用合约<br/>Facilitator 支付 Gas

    FC->>TR: 11. createTaskWithEIP3009(<br/>creator, description, reward,<br/>deadline, category,<br/>validAfter, validBefore, nonce,<br/>v, r, s)

    Note over TR: 执行 USDC 转账授权
    TR->>U: 12. transferWithAuthorization(<br/>from: creator,<br/>to: escrow,<br/>value: reward,<br/>v, r, s)

    Note over U: 验证签名:<br/>1. 恢复签名者地址<br/>2. 检查 nonce 未使用<br/>3. 检查时间窗口<br/>4. 执行转账

    U->>U: 13. ecrecover(digest, v, r, s)<br/>验证 signer == from
    U->>U: 14. _transfer(creator, escrow, reward)
    U-->>TR: 15. 转账成功

    Note over TR: 注册托管支付
    TR->>ES: 16. registerExternalPayment(<br/>paymentHash, creator, TaskRegistry,<br/>USDC, reward, deadline, taskId)
    ES-->>TR: 17. 支付已注册

    Note over TR: 创建任务并铸造 NFT
    TR->>TR: 18. 创建任务记录<br/>状态: Open
    TR->>TR: 19. _safeMint(creator, taskId)
    TR->>TR: 20. emit TaskCreated(...)

    TR-->>FC: 21. 返回 taskId 和 txHash

    Note over FC: 提取任务 ID
    FC->>FC: 22. 解析事件日志<br/>获取 taskId

    FC-->>F: 23. 返回结果<br/>{success: true, taskId, txHash, gasUsed}

    F-->>C: 24. 显示成功消息<br/>✅ 任务 #1 创建成功<br/>零 Gas 费用!

    Note over C: Creator 未支付任何 Gas<br/>Facilitator 支付了 ~$0.12
```

### 2.2 EIP-3009 签名生成流程

```mermaid
graph TB
    Start([开始生成签名]) --> GetSigner[获取 Wallet Signer]
    GetSigner --> GenerateNonce[生成随机 Nonce<br/>32 bytes]
    GenerateNonce --> SetTimeWindow[设置时间窗口<br/>validAfter: 0<br/>validBefore: now + 1h]

    SetTimeWindow --> BuildDomain[构建 EIP-712 Domain]
    BuildDomain --> DomainDetails[name: 'USD Coin'<br/>version: '1'<br/>chainId: 31337<br/>verifyingContract: USDC]

    DomainDetails --> BuildTypes[定义 Types]
    BuildTypes --> TypesDetails[TransferWithAuthorization:<br/>- from: address<br/>- to: address<br/>- value: uint256<br/>- validAfter: uint256<br/>- validBefore: uint256<br/>- nonce: bytes32]

    TypesDetails --> BuildMessage[构建 Message]
    BuildMessage --> MessageDetails[from: Creator 地址<br/>to: Escrow 地址<br/>value: 奖励金额<br/>validAfter: 0<br/>validBefore: timestamp<br/>nonce: 随机值]

    MessageDetails --> SignTypedData[调用 signer.signTypedData<br/>domain, types, message]
    SignTypedData --> MetaMaskPrompt[MetaMask 弹窗<br/>显示签名详情]

    MetaMaskPrompt --> UserConfirm{用户确认?}
    UserConfirm -->|取消| Cancelled([签名取消])
    UserConfirm -->|确认| GetSignature[获取签名字符串<br/>0x1234...]

    GetSignature --> SplitSignature[分解签名<br/>ethers.Signature.from]
    SplitSignature --> ExtractVRS[提取 v, r, s]

    ExtractVRS --> ReturnSignature[返回签名对象]
    ReturnSignature --> SignatureObject["{<br/>  v: 27 or 28,<br/>  r: '0x123...',<br/>  s: '0x456...',<br/>  nonce: '0x789...',<br/>  validAfter: 0,<br/>  validBefore: 1730000000<br/>}"]

    SignatureObject --> End([签名生成完成])

    style Start fill:#e1f5ff
    style End fill:#d4edda
    style Cancelled fill:#f8d7da
    style MetaMaskPrompt fill:#fff3cd
    style SignatureObject fill:#d4edda
```

---

## 3. 任务状态机

### 3.1 完整状态转换图

```mermaid
stateDiagram-v2
    [*] --> Open: createTask() or<br/>createTaskWithEIP3009()

    Open --> Assigned: assignTask()<br/>Worker 质押
    Open --> Cancelled: cancelTask()<br/>Creator 取消

    Assigned --> Submitted: submitTask()<br/>Worker 提交结果
    Assigned --> Open: abandonTask()<br/>Worker 放弃<br/>质押被没收
    Assigned --> Cancelled: cancelTask()<br/>超时后 Creator 取消

    Submitted --> Verified: verifyTask(true)<br/>Verifier 通过
    Submitted --> Rejected: verifyTask(false)<br/>Verifier 拒绝

    Rejected --> Submitted: submitTask()<br/>Worker 重新提交
    Rejected --> Open: 超过重试次数<br/>or Worker 放弃

    Verified --> Completed: settle()<br/>自动结算<br/>退还质押

    Completed --> [*]
    Cancelled --> [*]

    note right of Open
        任务已创建
        USDC 托管到 Escrow
        等待 Worker 接取
    end note

    note right of Assigned
        Worker 已接取
        质押金已锁定
        开始执行任务
    end note

    note right of Submitted
        结果已提交
        IPFS 哈希已记录
        等待 Verifier 验证
    end note

    note right of Verified
        验证通过
        准备结算
    end note

    note right of Completed
        任务完成
        资金已分配:
        - Worker: 98%
        - Platform: 1.5%
        - Verifier: 0.5%
        质押已退还
    end note
```

### 3.2 状态转换权限矩阵

```mermaid
graph TB
    subgraph 状态转换权限
        Open[Open 状态]
        Assigned[Assigned 状态]
        Submitted[Submitted 状态]
        Verified[Verified 状态]
        Completed[Completed 状态]
        Cancelled[Cancelled 状态]
        Rejected[Rejected 状态]

        Open -->|assignTask<br/>任何人| Assigned
        Open -->|cancelTask<br/>Creator| Cancelled

        Assigned -->|submitTask<br/>Worker| Submitted
        Assigned -->|abandonTask<br/>Worker| Open
        Assigned -->|cancelTask<br/>Creator 超时后| Cancelled

        Submitted -->|verifyTask(true)<br/>Verifier| Verified
        Submitted -->|verifyTask(false)<br/>Verifier| Rejected

        Rejected -->|submitTask<br/>Worker| Submitted

        Verified -->|settle<br/>System 自动| Completed
    end

    style Open fill:#e1f5ff
    style Assigned fill:#fff3cd
    style Submitted fill:#cce5ff
    style Verified fill:#d1ecf1
    style Completed fill:#d4edda
    style Cancelled fill:#f8d7da
    style Rejected fill:#f8d7da
```

---

## 4. 资金流转图

### 4.1 USDC 资金流转全景图

```mermaid
graph TB
    subgraph 创建阶段
        Creator[Creator<br/>初始 1000 USDC] -->|createTask<br/>50 USDC| TaskRegistry[TaskRegistry 合约]
        TaskRegistry -->|transfer<br/>50 USDC| Escrow[X402Escrow<br/>托管 50 USDC]
    end

    subgraph 接取阶段
        Worker[Worker] -->|assignTask<br/>质押 10 USDC 20%| StakePool[TaskRegistry<br/>质押池]
    end

    subgraph 完成阶段
        Escrow -->|settle 自动结算| Distribution{资金分配}

        Distribution -->|98%<br/>49.0 USDC| Worker2[Worker 账户]
        Distribution -->|1.5%<br/>0.75 USDC| Platform[Platform 账户]
        Distribution -->|0.5%<br/>0.25 USDC| Verifier[Verifier 账户]

        StakePool -->|refundStake<br/>10 USDC| Worker2
    end

    subgraph 最终余额
        CreatorFinal[Creator: 950 USDC]
        WorkerFinal[Worker: +59 USDC<br/>49 奖励 + 10 质押退还]
        PlatformFinal[Platform: +0.75 USDC]
        VerifierFinal[Verifier: +0.25 USDC]
    end

    Creator -.->|最终| CreatorFinal
    Worker2 -.->|最终| WorkerFinal
    Platform -.->|最终| PlatformFinal
    Verifier -.->|最终| VerifierFinal

    style Creator fill:#e1f5ff
    style Escrow fill:#fff3cd
    style Distribution fill:#ffc107
    style Worker2 fill:#d4edda
    style Platform fill:#d1ecf1
    style Verifier fill:#d1ecf1
    style WorkerFinal fill:#d4edda
```

### 4.2 质押机制流程

```mermaid
graph LR
    subgraph 正常完成流程
        A1[Worker 接取任务] --> A2[支付质押<br/>20% 奖励]
        A2 --> A3[质押锁定在合约]
        A3 --> A4[完成并提交]
        A4 --> A5[验证通过]
        A5 --> A6[质押全额退还<br/>+ 98% 奖励]
    end

    subgraph 放弃任务流程
        B1[Worker 接取任务] --> B2[支付质押<br/>20% 奖励]
        B2 --> B3[质押锁定在合约]
        B3 --> B4[Worker 放弃任务<br/>abandonTask]
        B4 --> B5[质押没收<br/>转给 Platform]
        B5 --> B6[任务重新开放]
    end

    style A6 fill:#d4edda
    style B5 fill:#f8d7da
    style B6 fill:#fff3cd
```

---

## 5. 系统交互序列图

### 5.1 标准模式创建任务序列图

```mermaid
sequenceDiagram
    participant C as Creator
    participant F as Frontend
    participant M as MetaMask
    participant TR as TaskRegistry
    participant ES as Escrow
    participant U as USDC

    C->>F: 填写任务信息
    C->>F: 点击"创建任务"

    Note over F: 第一步: Approve USDC
    F->>M: 请求 approve
    M->>C: 确认交易 1
    C->>M: 确认
    M->>U: approve(TaskRegistry, amount)
    U-->>M: 授权成功
    M-->>F: 交易成功

    Note over F: 第二步: 创建任务
    F->>M: 请求 createTask
    M->>C: 确认交易 2
    C->>M: 确认
    M->>TR: createTask(desc, reward, deadline, category)

    Note over TR: 处理任务创建
    TR->>U: transferFrom(creator, escrow, reward)
    U->>ES: transfer 50 USDC
    U-->>TR: 转账成功

    TR->>ES: createPayment(hash, taskRegistry, USDC, reward, deadline, taskId)
    ES-->>TR: 支付已创建

    TR->>TR: 创建任务记录<br/>状态: Open
    TR->>TR: _safeMint(creator, taskId)
    TR->>TR: emit TaskCreated

    TR-->>M: 交易成功<br/>taskId = 1
    M-->>F: receipt
    F-->>C: ✅ 任务 #1 创建成功<br/>Gas 费用: ~$0.05
```

### 5.2 Worker 接取并完成任务序列图

```mermaid
sequenceDiagram
    participant W as Worker
    participant F as Frontend
    participant M as MetaMask
    participant TR as TaskRegistry
    participant ES as Escrow
    participant I as IPFS

    Note over W,F: 阶段1: 浏览任务
    W->>F: 访问任务列表
    F->>TR: getOpenTasks(limit)
    TR-->>F: [taskId 1, 2, 3...]
    F->>TR: tasks(1)
    TR-->>F: Task 详情
    F-->>W: 显示任务列表

    Note over W,F: 阶段2: 接取任务
    W->>F: 点击"接取任务"
    F->>M: 请求 assignTask
    M->>W: 确认交易<br/>需支付质押 10 USDC
    W->>M: 确认
    M->>TR: assignTask(taskId) {value: 10 USDC}
    TR->>TR: 锁定质押<br/>task.status = Assigned
    TR->>ES: updatePayee(hash, worker)
    TR->>TR: emit TaskAssigned
    TR-->>M: 接取成功
    M-->>F: receipt
    F-->>W: ✅ 任务已接取

    Note over W,I: 阶段3: 执行任务
    W->>W: 完成任务工作
    W->>I: 上传结果文件
    I-->>W: 返回 IPFS 哈希<br/>QmXxxx...

    Note over W,F: 阶段4: 提交结果
    W->>F: 输入 IPFS 哈希
    W->>F: 点击"提交"
    F->>M: 请求 submitTask
    M->>W: 确认交易
    W->>M: 确认
    M->>TR: submitTask(taskId, ipfsHash)
    TR->>TR: task.resultHash = ipfsHash<br/>task.status = Submitted
    TR->>TR: emit TaskSubmitted
    TR-->>M: 提交成功
    M-->>F: receipt
    F-->>W: ✅ 结果已提交<br/>等待验证
```

### 5.3 Verifier 验证并结算序列图

```mermaid
sequenceDiagram
    participant V as Verifier
    participant F as Frontend
    participant I as IPFS
    participant M as MetaMask
    participant TR as TaskRegistry
    participant ES as Escrow
    participant U as USDC
    participant W as Worker
    participant P as Platform

    Note over V,I: 阶段1: 下载并审核
    V->>F: 查看待验证任务
    F->>TR: 过滤 Submitted 状态
    TR-->>F: [taskId 1]
    F-->>V: 显示任务详情<br/>IPFS: QmXxxx...

    V->>I: 下载结果文件<br/>https://ipfs.io/ipfs/QmXxxx
    I-->>V: 返回文件内容
    V->>V: 审核质量

    Note over V,F: 阶段2: 验证决定
    V->>F: 点击"通过"
    F->>M: 请求 verifyTask(taskId, true)
    M->>V: 确认交易
    V->>M: 确认
    M->>TR: verifyTask(taskId, true)

    Note over TR: 更新状态并结算
    TR->>TR: task.status = Verified
    TR->>ES: settle(paymentHash)

    Note over ES: 计算分配金额
    ES->>ES: workerAmount = 50 * 98% = 49.0 USDC
    ES->>ES: platformFee = 50 * 1.5% = 0.75 USDC
    ES->>ES: verifierFee = 50 * 0.5% = 0.25 USDC

    Note over ES,U: 执行转账
    ES->>U: transfer(worker, 49.0 USDC)
    U-->>W: +49.0 USDC

    ES->>U: transfer(platform, 0.75 USDC)
    U-->>P: +0.75 USDC

    ES->>U: transfer(verifier, 0.25 USDC)
    U-->>V: +0.25 USDC

    ES->>ES: payment.settled = true
    ES->>ES: emit PaymentSettled
    ES-->>TR: 结算完成

    Note over TR: 退还质押
    TR->>TR: task.status = Completed
    TR->>U: transfer(worker, 10 USDC)
    U-->>W: +10 USDC (质押退还)
    TR->>TR: task.stakeRefunded = true

    TR->>TR: emit TaskCompleted
    TR-->>M: 验证并结算完成
    M-->>F: receipt
    F-->>V: ✅ 任务已验证完成<br/>您获得 0.25 USDC

    Note over W: Worker 最终收益<br/>49.0 USDC (奖励)<br/>+ 10 USDC (质押退还)<br/>= 59 USDC 总计
```

---

## 6. 用户角色交互图

### 6.1 多角色协作流程

```mermaid
graph TB
    subgraph Creator 视角
        C1[登录钱包] --> C2[创建任务]
        C2 --> C3{选择模式}
        C3 -->|标准| C4[支付 Gas<br/>2次交易]
        C3 -->|零Gas| C5[签名授权<br/>无需 ETH]
        C4 --> C6[任务发布]
        C5 --> C6
        C6 --> C7[等待 Worker]
        C7 --> C8[监控进度]
        C8 --> C9[任务完成]
    end

    subgraph Worker 视角
        W1[浏览任务] --> W2[查看详情]
        W2 --> W3{符合能力?}
        W3 -->|是| W4[支付质押<br/>接取任务]
        W3 -->|否| W1
        W4 --> W5[执行任务]
        W5 --> W6[上传 IPFS]
        W6 --> W7[提交结果]
        W7 --> W8[等待验证]
        W8 --> W9{验证结果}
        W9 -->|通过| W10[获得奖励<br/>+ 质押退还]
        W9 -->|拒绝| W11[修改并重新提交]
        W11 --> W6
    end

    subgraph Verifier 视角
        V1[查看待验证] --> V2[下载结果]
        V2 --> V3[审核质量]
        V3 --> V4{是否合格?}
        V4 -->|合格| V5[通过验证]
        V4 -->|不合格| V6[拒绝并说明]
        V5 --> V7[触发结算]
        V7 --> V8[获得验证费<br/>0.5%]
        V6 --> V9[等待重新提交]
    end

    subgraph Platform 视角
        P1[系统监控] --> P2[处理结算]
        P2 --> P3[收取手续费<br/>1.5%]
        P3 --> P4[维护运营]
    end

    C6 -.->|任务发布| W1
    W7 -.->|结果提交| V1
    V5 -.->|验证通过| P2
    V7 -.->|自动结算| W10
    V7 -.->|自动结算| P3

    style C6 fill:#e1f5ff
    style W10 fill:#d4edda
    style V8 fill:#d4edda
    style P3 fill:#d1ecf1
    style C5 fill:#e7d4f7
```

### 6.2 异常处理流程

```mermaid
graph TB
    Start([任务执行中]) --> Check{检测异常}

    Check -->|Worker 超时| Timeout[deadline 已过<br/>status: Assigned]
    Timeout --> CreatorCancel[Creator 调用 cancelTask]
    CreatorCancel --> RefundCreator[退款给 Creator]
    RefundCreator --> RefundWorkerStake[退还 Worker 质押]
    RefundWorkerStake --> End1([任务取消])

    Check -->|Worker 放弃| Abandon[Worker 调用 abandonTask]
    Abandon --> SlashStake[没收质押<br/>转给 Platform]
    SlashStake --> ReopenTask[任务重新开放<br/>status: Open]
    ReopenTask --> End2([等待新 Worker])

    Check -->|验证拒绝| Reject[Verifier 拒绝<br/>verifyTask(false)]
    Reject --> UpdateStatus[status: Rejected]
    UpdateStatus --> WorkerRetry{Worker 重试?}
    WorkerRetry -->|是| Resubmit[修改并重新提交<br/>submitTask]
    WorkerRetry -->|否| WorkerAbandon[Worker 放弃]
    Resubmit --> End3([重新等待验证])
    WorkerAbandon --> SlashStake

    Check -->|Facilitator 宕机| FacilitatorDown[零Gas服务不可用]
    FacilitatorDown --> SwitchMode{用户选择}
    SwitchMode -->|切换| StandardMode[使用标准模式]
    SwitchMode -->|等待| WaitRetry[等待服务恢复]
    SwitchMode -->|备用| BackupFacilitator[使用备用 Facilitator]
    StandardMode --> End4([继续创建])
    WaitRetry --> End5([稍后重试])
    BackupFacilitator --> End6([继续创建])

    Check -->|Gas 过高| HighGas[Gas > 100 gwei]
    HighGas --> FacilitatorReject[Facilitator 拒绝]
    FacilitatorReject --> NotifyUser[通知用户<br/>Gas 价格过高]
    NotifyUser --> UserChoice{用户选择}
    UserChoice -->|等待| WaitGas[等待 Gas 降低]
    UserChoice -->|标准| UseStandard[使用标准模式<br/>自行支付 Gas]
    WaitGas --> End7([稍后重试])
    UseStandard --> End8([继续创建])

    style End1 fill:#f8d7da
    style End2 fill:#fff3cd
    style End3 fill:#cce5ff
    style End4 fill:#d4edda
    style End5 fill:#fff3cd
    style End6 fill:#d4edda
    style End7 fill:#fff3cd
    style End8 fill:#d4edda
    style SlashStake fill:#f8d7da
```

---

## 7. 技术流程图

### 7.1 Facilitator 服务处理流程

```mermaid
graph TB
    Start([接收 POST 请求]) --> ParseRequest[解析请求体<br/>creator, signature, task]

    ParseRequest --> Step1{步骤1: 验证签名}
    Step1 --> VerifySig[调用 verifyEIP3009Signature]
    VerifySig --> CheckSig{签名有效?}
    CheckSig -->|否| Error1[返回错误:<br/>Invalid signature]
    CheckSig -->|是| Step2{步骤2: 检查 Gas}

    Step2 --> GetGasPrice[获取当前 Gas 价格]
    GetGasPrice --> CompareGas{Gas < 100 gwei?}
    CompareGas -->|否| Error2[返回错误:<br/>Gas price too high]
    CompareGas -->|是| Step3{步骤3: 调用合约}

    Step3 --> ConnectProvider[连接 RPC Provider]
    ConnectProvider --> CreateWallet[创建 Wallet<br/>使用私钥]
    CreateWallet --> GetContract[获取 TaskRegistry 合约]

    GetContract --> CallContract[调用 createTaskWithEIP3009<br/>传入 creator 和签名]
    CallContract --> WaitTx[等待交易确认]
    WaitTx --> CheckReceipt{交易成功?}
    CheckReceipt -->|否| Error3[返回错误:<br/>Transaction failed]

    CheckReceipt -->|是| Step4{步骤4: 解析事件}
    Step4 --> ParseLogs[遍历交易日志]
    ParseLogs --> FindEvent[查找 TaskCreated 事件]
    FindEvent --> ExtractId[提取 taskId]

    ExtractId --> Step5{步骤5: 返回结果}
    Step5 --> BuildResponse[构建响应<br/>success, taskId, txHash, gasUsed]
    BuildResponse --> End([返回 JSON])

    Error1 --> End
    Error2 --> End
    Error3 --> End

    style Start fill:#e1f5ff
    style End fill:#d4edda
    style Error1 fill:#f8d7da
    style Error2 fill:#f8d7da
    style Error3 fill:#f8d7da
    style CallContract fill:#e7d4f7
```

### 7.2 签名验证流程（USDC 合约）

```mermaid
graph TB
    Start([transferWithAuthorization]) --> GetParams[获取参数<br/>from, to, value<br/>validAfter, validBefore<br/>nonce, v, r, s]

    GetParams --> Check1{检查1: Nonce}
    Check1 --> CheckNonce[authorizationState<br/>from, nonce]
    CheckNonce --> NonceUsed{Nonce 已使用?}
    NonceUsed -->|是| Error1[Revert:<br/>Nonce already used]
    NonceUsed -->|否| Check2{检查2: 时间窗口}

    Check2 --> CheckTime1[block.timestamp > validAfter?]
    CheckTime1 --> TimeValid1{有效?}
    TimeValid1 -->|否| Error2[Revert:<br/>Not yet valid]
    TimeValid1 -->|是| CheckTime2[block.timestamp < validBefore?]
    CheckTime2 --> TimeValid2{有效?}
    TimeValid2 -->|否| Error3[Revert:<br/>Authorization expired]

    TimeValid2 -->|是| Check3{检查3: 签名验证}
    Check3 --> BuildDigest[构建 EIP-712 Digest]
    BuildDigest --> DigestSteps["digest = keccak256(<br/>  '\\x19\\x01',<br/>  DOMAIN_SEPARATOR,<br/>  structHash<br/>)"]

    DigestSteps --> Recover[ecrecover(digest, v, r, s)]
    Recover --> GetSigner[获取签名者地址]
    GetSigner --> CompareSigner{signer == from?}
    CompareSigner -->|否| Error4[Revert:<br/>Invalid signature]

    CompareSigner -->|是| Step4[步骤4: 标记 Nonce]
    Step4 --> MarkNonce[authorizationState<br/>from, nonce = true]

    MarkNonce --> Step5[步骤5: 执行转账]
    Step5 --> Transfer[_transfer(from, to, value)]
    Transfer --> End([转账成功])

    Error1 --> Fail([交易失败])
    Error2 --> Fail
    Error3 --> Fail
    Error4 --> Fail

    style Start fill:#e1f5ff
    style End fill:#d4edda
    style Fail fill:#f8d7da
    style Recover fill:#fff3cd
    style Transfer fill:#d4edda
```

---

## 8. 前端状态管理流程

### 8.1 任务创建表单状态流

```mermaid
stateDiagram-v2
    [*] --> FormIdle: 页面加载

    FormIdle --> FormEditing: 用户输入
    FormEditing --> FormValidating: 点击创建

    FormValidating --> FormError: 验证失败
    FormError --> FormEditing: 修改输入

    FormValidating --> ModeCheck: 验证通过

    ModeCheck --> StandardFlow: 标准模式
    ModeCheck --> ZeroGasFlow: 零Gas模式

    StandardFlow --> ApprovingUSDC: 请求 Approve
    ApprovingUSDC --> ApproveConfirming: MetaMask 弹窗1
    ApproveConfirming --> ApproveWaiting: 用户确认
    ApproveWaiting --> ApproveSuccess: 交易确认
    ApproveSuccess --> CreatingTask: 请求 Create

    ZeroGasFlow --> Signing: 请求签名
    Signing --> SignatureConfirming: MetaMask 弹窗
    SignatureConfirming --> SignatureWaiting: 用户确认
    SignatureWaiting --> SignatureSuccess: 签名获取
    SignatureSuccess --> SendingToFacilitator: POST API

    CreatingTask --> CreateConfirming: MetaMask 弹窗2
    CreateConfirming --> CreateWaiting: 用户确认
    CreateWaiting --> TaskCreated: 交易确认

    SendingToFacilitator --> FacilitatorProcessing: 等待响应
    FacilitatorProcessing --> TaskCreated: 成功返回
    FacilitatorProcessing --> FacilitatorError: 失败

    FacilitatorError --> FormError: 显示错误
    CreateWaiting --> CreateError: 交易失败
    CreateError --> FormError

    TaskCreated --> ShowSuccess: 显示成功
    ShowSuccess --> [*]: 重定向到任务详情

    note right of StandardFlow
        Gas 费用: ~$0.05
        需要 ETH: 是
        交易次数: 2
    end note

    note right of ZeroGasFlow
        Gas 费用: $0
        需要 ETH: 否
        交易次数: 0
        签名次数: 1
    end note
```

### 8.2 任务列表数据获取流程

```mermaid
graph TB
    Start([组件加载]) --> InitHook[初始化 React Hooks]
    InitHook --> GetTaskCount[useReadContract:<br/>getTotalTasks]
    GetTaskCount --> ReceiveCount[taskCount = 10]

    ReceiveCount --> BuildArray[构建 taskId 数组<br/>[1, 2, 3, ..., 10]]
    BuildArray --> BatchRead[useReadContracts:<br/>批量读取任务]

    BatchRead --> ReadLoop{遍历 taskIds}
    ReadLoop --> ReadTask[读取 tasks(id)]
    ReadTask --> NextTask{还有更多?}
    NextTask -->|是| ReadLoop
    NextTask -->|否| ProcessData[处理返回数据]

    ProcessData --> FilterStatus[过滤状态<br/>status === Open]
    FilterStatus --> SortTasks[排序<br/>按创建时间降序]
    SortTasks --> MapDisplay[映射到 UI 组件]

    MapDisplay --> RenderCard[渲染任务卡片]
    RenderCard --> DisplayInfo[显示信息:<br/>- 描述<br/>- 奖励<br/>- 截止时间<br/>- 分类]

    DisplayInfo --> End([渲染完成])

    style Start fill:#e1f5ff
    style End fill:#d4edda
    style BatchRead fill:#fff3cd
    style FilterStatus fill:#cce5ff
```

---

## 9. 总结

### 9.1 核心流程对比表

| 流程阶段 | 标准模式 | 零Gas模式 | 优势 |
|---------|---------|----------|------|
| **用户操作** | 2次交易确认 | 1次签名 | 零Gas: 更简单 |
| **Gas成本** | ~$0.05 | $0 | 零Gas: 无成本 |
| **ETH需求** | 必须有 | 不需要 | 零Gas: 无门槛 |
| **完成时间** | ~6秒 | ~5秒 | 相当 |
| **安全性** | 高（链上验证） | 高（EIP-712签名） | 相当 |
| **复杂度** | 低 | 中 | 标准: 更简单 |
| **用户体验** | 中 | 优秀 | 零Gas: 最佳 |

### 9.2 关键技术创新点

1. **EIP-3009 集成**: USDC 原生支持的授权转账，实现真正的零 Gas
2. **Facilitator 模式**: 服务器代付 Gas，用户无需持有 ETH
3. **双模式支持**: 标准模式和零 Gas 模式无缝切换
4. **质押机制**: 防止 Worker 恶意接单后放弃
5. **自动结算**: Verifier 验证后自动分配资金
6. **NFT 任务**: 每个任务是一个 NFT，可转让和交易

### 9.3 流程优化建议

1. **批量操作**: 支持一次签名创建多个任务
2. **自动重试**: Facilitator 失败时前端自动重试
3. **Gas 预测**: 实时显示预估 Gas 费用
4. **状态推送**: WebSocket 实时同步任务状态
5. **通知系统**: 任务状态变更时推送通知给相关方
6. **IPFS 加速**: 使用 Pinata/Web3.Storage 加速文件访问

---

**文档版本**: 1.0.0
**发布日期**: 2025-10-30
**作者**: X402 开发团队

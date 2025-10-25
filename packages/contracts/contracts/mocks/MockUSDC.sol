// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title MockUSDC
 * @notice Mock USDC 合约,完整实现 EIP-3009 transferWithAuthorization
 * @dev 用于测试,模拟真实 USDC 的 EIP-3009 功能
 */
contract MockUSDC is ERC20, EIP712 {
    using ECDSA for bytes32;

    // EIP-3009 相关
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    // Nonce 状态追踪
    mapping(address => mapping(bytes32 => bool)) private _authorizationStates;

    // 事件
    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);

    /**
     * @notice 构造函数
     * @param name 代币名称
     * @param symbol 代币符号
     */
    constructor(string memory name, string memory symbol)
        ERC20(name, symbol)
        EIP712(name, "1")
    {}

    /**
     * @notice Mint 代币 (仅用于测试)
     * @param to 接收地址
     * @param amount 数量
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice 设置小数位数为 6 (与真实 USDC 一致)
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @notice EIP-3009: Execute a transfer with a signed authorization
     * @param from Payer's address (Authorizer)
     * @param to Payee's address
     * @param value Amount to be transferred
     * @param validAfter The time after which this is valid (unix time)
     * @param validBefore The time before which this is valid (unix time)
     * @param nonce Unique nonce
     * @param v ECDSA signature parameter v
     * @param r ECDSA signature parameter r
     * @param s ECDSA signature parameter s
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // 验证时间范围
        require(block.timestamp > validAfter, "Authorization not yet valid");
        require(block.timestamp < validBefore, "Authorization expired");

        // 验证 nonce 未使用
        require(
            !_authorizationStates[from][nonce],
            "Authorization already used"
        );

        // 构造 EIP-712 结构化数据哈希
        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);

        // 恢复签名者地址
        address signer = digest.recover(v, r, s);

        // 验证签名者是授权者
        require(signer == from, "Invalid signature");

        // 标记 nonce 已使用
        _authorizationStates[from][nonce] = true;

        // 执行转账
        _transfer(from, to, value);

        emit AuthorizationUsed(from, nonce);
    }

    /**
     * @notice EIP-3009: Receive a transfer with a signed authorization from the payer
     * @dev This has an additional check to ensure that the payee's address matches
     *      the caller of this function to prevent front-running attacks.
     * @param from Payer's address (Authorizer)
     * @param to Payee's address
     * @param value Amount to be transferred
     * @param validAfter The time after which this is valid (unix time)
     * @param validBefore The time before which this is valid (unix time)
     * @param nonce Unique nonce
     * @param v ECDSA signature parameter v
     * @param r ECDSA signature parameter r
     * @param s ECDSA signature parameter s
     */
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // 额外检查: 收款方必须是调用者
        require(to == msg.sender, "Caller must be the payee");

        // 验证时间范围
        require(block.timestamp > validAfter, "Authorization not yet valid");
        require(block.timestamp < validBefore, "Authorization expired");

        // 验证 nonce 未使用
        require(
            !_authorizationStates[from][nonce],
            "Authorization already used"
        );

        // 构造 EIP-712 结构化数据哈希
        bytes32 structHash = keccak256(
            abi.encode(
                RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);

        // 恢复签名者地址
        address signer = digest.recover(v, r, s);

        // 验证签名者是授权者
        require(signer == from, "Invalid signature");

        // 标记 nonce 已使用
        _authorizationStates[from][nonce] = true;

        // 执行转账
        _transfer(from, to, value);

        emit AuthorizationUsed(from, nonce);
    }

    /**
     * @notice Check if an authorization is used
     * @param authorizer Authorizer's address
     * @param nonce Nonce of the authorization
     * @return True if the nonce is used
     */
    function authorizationState(address authorizer, bytes32 nonce)
        external
        view
        returns (bool)
    {
        return _authorizationStates[authorizer][nonce];
    }

    /**
     * @notice Get the EIP-712 domain separator
     */
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @notice Version string for EIP-712
     */
    function version() external pure returns (string memory) {
        return "1";
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IUSDC
 * @notice USDC 合约接口,包含 EIP-3009 transferWithAuthorization
 * @dev Base Sepolia USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
 *      Base Mainnet USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
 */
interface IUSDC is IERC20 {
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
    ) external;

    /**
     * @notice EIP-3009: Execute a transfer with a signed authorization (alternative with signature bytes)
     * @param from Payer's address (Authorizer)
     * @param to Payee's address
     * @param value Amount to be transferred
     * @param validAfter The time after which this is valid (unix time)
     * @param validBefore The time before which this is valid (unix time)
     * @param nonce Unique nonce
     * @param signature Signature byte array produced by signing the EIP-712 hash
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external;

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
    ) external;

    /**
     * @notice Check if an authorization is used
     * @param authorizer Authorizer's address
     * @param nonce Nonce of the authorization
     * @return True if the nonce is used
     */
    function authorizationState(address authorizer, bytes32 nonce)
        external
        view
        returns (bool);

    /**
     * @notice EIP-712 domain separator
     */
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    /**
     * @notice Version string for EIP-712
     */
    function version() external view returns (string memory);
}

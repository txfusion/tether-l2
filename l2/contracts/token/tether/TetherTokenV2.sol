// SPDX-License-Identifier: Apache 2.0
pragma solidity 0.8.24;

import "./TetherToken.sol";
import "./EIP3009Upgradeable.sol";

contract TetherTokenV2 is TetherToken, EIP3009Upgradeable {
    /////////////////////////////////////
    //    Public/External Functions    //
    ////////////////////////////////////
    /**
     * @notice Update allowance with a signed permit
     * @param owner_       Token owner's address
     * @param spender     Spender's address
     * @param value       Amount of allowance
     * @param deadline    The time at which the signature expires (unix time)
     * @param v   signature component v
     * @param r   signature component r
     * @param s   signature component s
     */
    function permit(address owner_, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        public
        virtual
        override
    {
        _permit(owner_, spender, value, deadline, abi.encodePacked(r, s, v));
    }

    /**
     * @notice Update allowance with a signed permit
     * @dev EOA wallet signatures should be packed in the order of r, s, v.
     * @param owner_       Token owner's address (Authorizer)
     * @param spender     Spender's address
     * @param value       Amount of allowance
     * @param deadline    The time at which the signature expires (unix time), or max uint256 value to signal no expiration
     * @param signature   Signature bytes signed by an EOA wallet or a contract wallet
     */
    function permit(address owner_, address spender, uint256 value, uint256 deadline, bytes memory signature)
        external
    {
        _permit(owner_, spender, value, deadline, signature);
    }

    /**
     * @notice Execute a transfer with a signed authorization
     * @param from          Payer's address (Authorizer)
     * @param to            Payee's address
     * @param value         Amount to be transferred
     * @param validAfter    The time after which this is valid (unix time)
     * @param validBefore   The time before which this is valid (unix time)
     * @param nonce         Unique nonce
     * @param v             v of the signature
     * @param r             r of the signature
     * @param s             s of the signature
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
    ) public onlyNotBlocked {
        _transferWithAuthorizationValidityCheck(
            from, to, value, validAfter, validBefore, nonce, abi.encodePacked(r, s, v)
        );

        _transfer(from, to, value);
    }

    /**
     * @notice Execute a transfer with a signed authorization
     * @dev EOA wallet signatures should be packed in the order of r, s, v.
     * @param from          Payer's address (Authorizer)
     * @param to            Payee's address
     * @param value         Amount to be transferred
     * @param validAfter    The time after which this is valid (unix time)
     * @param validBefore   The time before which this is valid (unix time)
     * @param nonce         Unique nonce
     * @param signature     Signature bytes signed by an EOA wallet or a contract wallet
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes memory signature
    ) external onlyNotBlocked {
        _transferWithAuthorizationValidityCheck(from, to, value, validAfter, validBefore, nonce, signature);

        _transfer(from, to, value);
    }

    /**
     * @notice Receive a transfer with a signed authorization from the payer
     * @dev This has an additional check to ensure that the payee's address
     * matches the caller of this function to prevent front-running attacks.
     * @param from          Payer's address (Authorizer)
     * @param to            Payee's address
     * @param value         Amount to be transferred
     * @param validAfter    The time after which this is valid (unix time)
     * @param validBefore   The time before which this is valid (unix time)
     * @param nonce         Unique nonce
     * @param v             v of the signature
     * @param r             r of the signature
     * @param s             s of the signature
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
    ) public onlyNotBlocked {
        _receiveWithAuthorizationValidityCheck(
            from, to, value, validAfter, validBefore, nonce, abi.encodePacked(r, s, v)
        );

        _transfer(from, to, value);
    }

    /**
     * @notice Receive a transfer with a signed authorization from the payer
     * @dev This has an additional check to ensure that the payee's address
     * matches the caller of this function to prevent front-running attacks.
     * EOA wallet signatures should be packed in the order of r, s, v.
     * @param from          Payer's address (Authorizer)
     * @param to            Payee's address
     * @param value         Amount to be transferred
     * @param validAfter    The time after which this is valid (unix time)
     * @param validBefore   The time before which this is valid (unix time)
     * @param nonce         Unique nonce
     * @param signature     Signature bytes signed by an EOA wallet or a contract wallet
     */
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes memory signature
    ) external onlyNotBlocked {
        _receiveWithAuthorizationValidityCheck(from, to, value, validAfter, validBefore, nonce, signature);

        _transfer(from, to, value);
    }

    //////////////////////////////////////
    //    Private/Internal Functions    //
    //////////////////////////////////////
    function _permit(address owner_, address spender, uint256 value, uint256 deadline, bytes memory signature)
        internal
    {
        require(block.timestamp <= deadline, "ERC20Permit: expired deadline");

        _requireValidSignature(
            owner_,
            keccak256(abi.encode(PERMIT_TYPEHASH, owner_, spender, value, _useNonce(owner_), deadline)),
            signature
        );

        _approve(owner_, spender, value);
    }

    uint256[48] private __gap;
}

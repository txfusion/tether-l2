// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {MessageHashUtils} from "./MessageHashUtils.sol";

abstract contract EIP3009Upgradeable is Initializable, EIP712Upgradeable {
    //////////////////
    //    Errors    //
    /////////////////
    error EIP3009Upgradeable__ErrorUnauthorized();
    error EIP3009Upgradeable__ErrorInvalidSignature();
    error EIP3009Upgradeable__ErrorNonceAlreadyUsed(bytes32 nonce);
    error EIP3009Upgradeable__ErrorAuthEarly();
    error EIP3009Upgradeable__ErrorAuthExpired();

    /////////////////////////////
    //    Storage Variables    //
    /////////////////////////////
    mapping(address authorizer => mapping(bytes32 nonce => bool isUsed)) private _authorizationStates;

    /////////////////////////////
    //    EIP712 Typehashes    //
    /////////////////////////////
    bytes32 public constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    bytes32 public constant CANCEL_AUTHORIZATION_TYPEHASH =
        keccak256("CancelAuthorization(address authorizer,bytes32 nonce)");

    //////////////////
    //    Events    //
    /////////////////
    event EIP3009Upgradeable__AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);
    event EIP3009Upgradeable__AuthorizationCanceled(address indexed authorizer, bytes32 indexed nonce);

    ////////////////////////
    //    Initializers    //
    ///////////////////////
    function __EIP3009Upgradeable_init(string memory name) internal onlyInitializing {
        __EIP712_init_unchained(name, "1");
    }

    /////////////////////////////////////
    //    Public/External Functions    //
    ////////////////////////////////////
    /**
     * Returns the state of an authorization
     * @dev Nonces are randomly generated 32-byte data unique to the authorizer's address
     * @param authorizer Authorizer's address
     * @param nonce Nonce of the authorization
     * @return True if the nonce is used
     */
    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool) {
        return _authorizationStates[authorizer][nonce];
    }

    /**
     * @notice Attempt to cancel an authorization
     * @param authorizer    Authorizer's address
     * @param nonce         Nonce of the authorization
     * @param v             v of the signature
     * @param r             r of the signature
     * @param s             s of the signature
     */
    function cancelAuthorization(address authorizer, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) public {
        _cancelAuthorization(authorizer, nonce, abi.encodePacked(r, s, v));
    }

    /**
     * @notice Attempt to cancel an authorization
     * @dev Works only if the authorization is not yet used. EOA wallet signatures should be packed in the order of r, s, v.
     * @param authorizer    Authorizer's address
     * @param nonce         Nonce of the authorization
     * @param signature     Signature bytes signed by an EOA wallet or a contract wallet
     */
    function cancelAuthorization(address authorizer, bytes32 nonce, bytes memory signature) external {
        _cancelAuthorization(authorizer, nonce, signature);
    }

    /**
     * @dev See {IERC20Permit-DOMAIN_SEPARATOR}.
     */
    // solhint-disable-next-line func-name-mixedcase
    function domainSeparator() public view virtual returns (bytes32) {
        return _domainSeparatorV4();
    }

    //////////////////////////////////////
    //    Private/Internal Functions    //
    /////////////////////////////////////
    /**
     * @notice Execute a transfer with a signed authorization
     * @param from          Payer's address (Authorizer)
     * @param to            Payee's address
     * @param value         Amount to be transferred
     * @param validAfter    The time after which this is valid (unix time)
     * @param validBefore   The time before which this is valid (unix time)
     * @param nonce         Unique nonce
     * @param signature signature in bytes
     */
    function _transferWithAuthorizationValidityCheck(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes memory signature
    ) internal {
        _requireValidAuthorization(from, nonce, validAfter, validBefore);
        _requireValidSignature(
            from,
            keccak256(abi.encode(TRANSFER_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce)),
            signature
        );

        _markAuthorizationAsUsed(from, nonce);
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
     * @param signature signature in bytes
     */
    function _receiveWithAuthorizationValidityCheck(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes memory signature
    ) internal {
        if (to != msg.sender) {
            revert EIP3009Upgradeable__ErrorUnauthorized();
        }

        _requireValidAuthorization(from, nonce, validAfter, validBefore);
        _requireValidSignature(
            from,
            keccak256(abi.encode(RECEIVE_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce)),
            signature
        );

        _markAuthorizationAsUsed(from, nonce);
    }

    /**
     * @notice Receive a transfer with a signed authorization from the payer
     * @dev This has an additional check to ensure that the payee's address
     * matches the caller of this function to prevent front-running attacks.
     * @param authorizer    Payer's address (Authorizer)
     * @param nonce         Unique nonce
     * @param signature     Signature in bytes
     */
    function _cancelAuthorization(address authorizer, bytes32 nonce, bytes memory signature) internal {
        _requireUnusedAuthorization(authorizer, nonce);
        _requireValidSignature(
            authorizer, keccak256(abi.encode(CANCEL_AUTHORIZATION_TYPEHASH, authorizer, nonce)), signature
        );

        _markAuthorizationAsCancelled(authorizer, nonce);
    }

    /**
     * @notice Validates that signature against input data struct
     * @param signer        Signer's address
     * @param dataHash      Hash of encoded data struct
     * @param signature signature in bytes
     */
    function _requireValidSignature(address signer, bytes32 dataHash, bytes memory signature) internal view {
        if (
            !SignatureChecker.isValidSignatureNow(
                signer, MessageHashUtils.toTypedDataHash(domainSeparator(), dataHash), signature
            )
        ) {
            revert EIP3009Upgradeable__ErrorInvalidSignature();
        }
    }

    /**
     * @notice Check that an authorization is unused
     * @param authorizer    Authorizer's address
     * @param nonce         Nonce of the authorization
     */
    function _requireUnusedAuthorization(address authorizer, bytes32 nonce) internal view {
        if (_authorizationStates[authorizer][nonce]) {
            revert EIP3009Upgradeable__ErrorNonceAlreadyUsed(nonce);
        }
    }

    /**
     * @notice Check that authorization is valid
     * @param authorizer    Authorizer's address
     * @param nonce         Nonce of the authorization
     * @param validAfter    The time after which this is valid (unix time)
     * @param validBefore   The time before which this is valid (unix time)
     */
    function _requireValidAuthorization(address authorizer, bytes32 nonce, uint256 validAfter, uint256 validBefore)
        internal
        view
    {
        if (block.timestamp < validAfter) {
            revert EIP3009Upgradeable__ErrorAuthEarly();
        }
        if (block.timestamp > validBefore) {
            revert EIP3009Upgradeable__ErrorAuthExpired();
        }
        _requireUnusedAuthorization(authorizer, nonce);
    }

    /**
     * @notice Mark an authorization as used
     * @param authorizer    Authorizer's address
     * @param nonce         Nonce of the authorization
     */
    function _markAuthorizationAsUsed(address authorizer, bytes32 nonce) internal {
        _authorizationStates[authorizer][nonce] = true;
        emit EIP3009Upgradeable__AuthorizationUsed(authorizer, nonce);
    }

    /**
     * @notice Mark an authorization as used
     * @param authorizer    Authorizer's address
     * @param nonce         Nonce of the authorization
     */
    function _markAuthorizationAsCancelled(address authorizer, bytes32 nonce) internal {
        _authorizationStates[authorizer][nonce] = true;
        emit EIP3009Upgradeable__AuthorizationCanceled(authorizer, nonce);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[49] private __gap;
}

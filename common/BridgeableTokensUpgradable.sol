// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @notice Upgradeable variant of contract that contains the logic for validation of tokens used in the bridging process
contract BridgeableTokensUpgradable is Initializable {
    ///////////////////
    //    Errors     //
    //////////////////
    error BridgeableTokensUpgradable__ErrorUnsupportedL1Token();
    error BridgeableTokensUpgradable__ErrorUnsupportedL2Token();
    error BridgeableTokensUpgradable__ErrorAccountIsZeroAddress();

    ////////////////////////////
    //    State Variables     //
    ///////////////////////////
    /// @param l1Token Address of the bridged token in the L1 chain
    /// @param l2Token A mapping chainId => bridgeProxy. Used to store the bridge proxy's address, and to see if it has been deployed yet.
    struct BTState {
        address l1Token;
        address l2Token;
    }

    /// @dev The location of the slot with State
    bytes32 private constant STATE_SLOT = bytes32(uint256(keccak256("BridgeableTokensUpgradable.bridgingState")) - 1);

    ///////////////////
    //    Events     //
    //////////////////
    event BridgeableTokensUpgradable__L1TokenUpdated(address indexed l1Token);
    event BridgeableTokensUpgradable__L2TokenUpdated(address indexed l2Token);

    //////////////////////
    //    Modifiers     //
    /////////////////////
    /// @dev Validates that passed l1Token_ is supported by the bridge
    modifier onlySupportedL1Token(address l1Token_) {
        if (!_isL1TokenSupported(l1Token_)) {
            revert BridgeableTokensUpgradable__ErrorUnsupportedL1Token();
        }
        _;
    }

    /// @dev Validates that passed l2Token_ is supported on the specified chainId_
    modifier onlySupportedL2Token(address l2Token_) {
        if (!_isL2TokenSupported(l2Token_)) {
            revert BridgeableTokensUpgradable__ErrorUnsupportedL2Token();
        }
        _;
    }

    /// @dev validates that addressToCheck_ is not zero address
    modifier onlyNonZeroAddress(address addressToCheck_) {
        if (addressToCheck_ == address(0)) {
            revert BridgeableTokensUpgradable__ErrorAccountIsZeroAddress();
        }
        _;
    }

    ////////////////////
    //  Initializer   //
    ///////////////////
    function __BridgeableTokens_init() internal onlyInitializing {}

    ///////////////////////////////////////
    //     Public/External Functions     //
    //////////////////////////////////////
    function l1Token() public view returns (address) {
        return _loadBTState().l1Token;
    }

    function l2Token() public view returns (address) {
        return _loadBTState().l2Token;
    }

    ////////////////////////////////////////
    //     Private/Internal Functions     //
    ////////////////////////////////////////
    function _isL1TokenSupported(address l1Token_) internal view returns (bool) {
        return l1Token_ == _loadBTState().l1Token;
    }

    function _isL2TokenSupported(address l2Token_) internal view returns (bool) {
        return l2Token_ == _loadBTState().l2Token;
    }

    function _setL1Token(address l1Token_) internal onlyNonZeroAddress(l1Token_) {
        _loadBTState().l1Token = l1Token_;
        emit BridgeableTokensUpgradable__L1TokenUpdated(l1Token_);
    }

    function _setL2Token(address l2Token_) internal onlyNonZeroAddress(l2Token_) {
        _loadBTState().l2Token = l2Token_;
        emit BridgeableTokensUpgradable__L2TokenUpdated(l2Token_);
    }

    /// @dev Returns the reference to the slot with State struct
    function _loadBTState() private pure returns (BTState storage r) {
        bytes32 slot = STATE_SLOT;
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}

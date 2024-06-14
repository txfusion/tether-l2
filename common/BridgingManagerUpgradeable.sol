// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/// @author psirex
/// @notice Contains administrative methods to retrieve and control the state of the bridging
contract BridgingManagerUpgradeable is Initializable, AccessControlUpgradeable {
    ///////////////////
    //    Errors     //
    //////////////////
    error BridgingManagerUpgradeable__ErrorDepositsEnabled();
    error BridgingManagerUpgradeable__ErrorDepositsDisabled();
    error BridgingManagerUpgradeable__ErrorWithdrawalsEnabled();
    error BridgingManagerUpgradeable__ErrorWithdrawalsDisabled();
    error BridgingManagerUpgradeable__ErrorAlreadyInitialized();

    ////////////////////////////
    //    State Variables     //
    ///////////////////////////
    /// @dev Stores the state of the bridging
    /// @param isInitialized Shows whether the contract is initialized or not
    /// @param isDepositsEnabled Stores the state of the deposits
    /// @param isWithdrawalsEnabled Stores the state of the withdrawals
    struct BMState {
        bool isInitialized;
        bool isDepositsEnabled;
        bool isWithdrawalsEnabled;
    }

    bytes32 public constant DEPOSITS_ENABLER_ROLE = keccak256("BridgingManagerUpgradeable.DEPOSITS_ENABLER_ROLE");
    bytes32 public constant DEPOSITS_DISABLER_ROLE = keccak256("BridgingManagerUpgradeable.DEPOSITS_DISABLER_ROLE");
    bytes32 public constant WITHDRAWALS_ENABLER_ROLE = keccak256("BridgingManagerUpgradeable.WITHDRAWALS_ENABLER_ROLE");
    bytes32 public constant WITHDRAWALS_DISABLER_ROLE =
        keccak256("BridgingManagerUpgradeable.WITHDRAWALS_DISABLER_ROLE");

    /// @dev The location of the slot with BMState
    bytes32 private constant STATE_SLOT = bytes32(uint256(keccak256("BridgingManagerUpgradeable.bridgingState")) - 1);

    ///////////////////
    //    Events     //
    //////////////////
    event BridgingManageUpgradeable__DepositsEnabled(address indexed enabler);
    event BridgingManageUpgradeable__DepositsDisabled(address indexed disabler);
    event BridgingManageUpgradeable__WithdrawalsEnabled(address indexed enabler);
    event BridgingManageUpgradeable__WithdrawalsDisabled(address indexed disabler);
    event BridgingManageUpgradeable__InitializedBridgingManagerUpgradeable(address indexed admin);

    //////////////////////
    //    Modifiers     //
    /////////////////////
    modifier whenDepositsEnabled() {
        if (!isDepositsEnabled()) {
            revert BridgingManagerUpgradeable__ErrorDepositsDisabled();
        }
        _;
    }

    modifier whenDepositsDisabled() {
        if (isDepositsEnabled()) {
            revert BridgingManagerUpgradeable__ErrorDepositsEnabled();
        }
        _;
    }

    modifier whenWithdrawalsEnabled() {
        if (!isWithdrawalsEnabled()) {
            revert BridgingManagerUpgradeable__ErrorWithdrawalsDisabled();
        }
        _;
    }

    modifier whenWithdrawalsDisabled() {
        if (isWithdrawalsEnabled()) {
            revert BridgingManagerUpgradeable__ErrorWithdrawalsEnabled();
        }
        _;
    }

    ////////////////////
    //  Initializer   //
    ///////////////////
    /// @notice Initializes the contract to grant DEFAULT_ADMIN_ROLE to the admin_ address
    /// @param admin_ Address of the account to grant the DEFAULT_ADMIN_ROLE
    function __BridgingManagerUpgradeable_init(address admin_) internal onlyInitializing {
        BMState storage s = _loadBMState();
        if (s.isInitialized) {
            revert BridgingManagerUpgradeable__ErrorAlreadyInitialized();
        }

        __AccessControl_init();
        _setupRole(DEFAULT_ADMIN_ROLE, admin_);

        s.isInitialized = true;
        s.isDepositsEnabled = true;
        s.isWithdrawalsEnabled = true;

        emit BridgingManageUpgradeable__InitializedBridgingManagerUpgradeable(admin_);
    }

    ///////////////////////////////////////
    //     Public/External Functions     //
    ///////////////////////////////////////
    /// @notice Returns whether the contract is initialized or not
    function isInitialized() public view returns (bool) {
        return _loadBMState().isInitialized;
    }

    /// @notice Returns whether the deposits are enabled or not
    function isDepositsEnabled() public view returns (bool) {
        return _loadBMState().isDepositsEnabled;
    }

    /// @notice Returns whether the withdrawals are enabled or not
    function isWithdrawalsEnabled() public view returns (bool) {
        return _loadBMState().isWithdrawalsEnabled;
    }

    /// @notice Enables the deposits if they are disabled
    function enableDeposits() external whenDepositsDisabled onlyRole(DEPOSITS_ENABLER_ROLE) {
        _loadBMState().isDepositsEnabled = true;
        emit BridgingManageUpgradeable__DepositsEnabled(msg.sender);
    }

    /// @notice Disables the deposits if they aren't disabled yet
    function disableDeposits() external whenDepositsEnabled onlyRole(DEPOSITS_DISABLER_ROLE) {
        _loadBMState().isDepositsEnabled = false;
        emit BridgingManageUpgradeable__DepositsDisabled(msg.sender);
    }

    /// @notice Enables the withdrawals if they are disabled
    function enableWithdrawals() external whenWithdrawalsDisabled onlyRole(WITHDRAWALS_ENABLER_ROLE) {
        _loadBMState().isWithdrawalsEnabled = true;
        emit BridgingManageUpgradeable__WithdrawalsEnabled(msg.sender);
    }

    /// @notice Disables the withdrawals if they aren't disabled yet
    function disableWithdrawals() external whenWithdrawalsEnabled onlyRole(WITHDRAWALS_DISABLER_ROLE) {
        _loadBMState().isWithdrawalsEnabled = false;
        emit BridgingManageUpgradeable__WithdrawalsDisabled(msg.sender);
    }

    ////////////////////////////////////////
    //     Private/Internal Functions     //
    ////////////////////////////////////////
    /// @dev Returns the reference to the slot with State struct
    function _loadBMState() private pure returns (BMState storage r) {
        bytes32 slot = STATE_SLOT;
        assembly {
            r.slot := slot
        }
    }
}

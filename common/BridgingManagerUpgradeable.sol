// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/// @author psirex
/// @notice Contains administrative methods to retrieve and control the state of the bridging
contract BridgingManagerUpgradeable is Initializable, AccessControlUpgradeable {
    /// @dev Stores the state of the bridging
    /// @param isInitialized Shows whether the contract is initialized or not
    /// @param isDepositsEnabled Stores the state of the deposits
    /// @param isWithdrawalsEnabled Stores the state of the withdrawals
    struct State {
        bool isInitialized;
        bool isDepositsEnabled;
        bool isWithdrawalsEnabled;
    }

    bytes32 public constant DEPOSITS_ENABLER_ROLE = keccak256("BridgingManagerUpgradeable.DEPOSITS_ENABLER_ROLE");
    bytes32 public constant DEPOSITS_DISABLER_ROLE = keccak256("BridgingManagerUpgradeable.DEPOSITS_DISABLER_ROLE");
    bytes32 public constant WITHDRAWALS_ENABLER_ROLE = keccak256("BridgingManagerUpgradeable.WITHDRAWALS_ENABLER_ROLE");
    bytes32 public constant WITHDRAWALS_DISABLER_ROLE =
        keccak256("BridgingManagerUpgradeable.WITHDRAWALS_DISABLER_ROLE");

    /// @dev The location of the slot with State
    bytes32 private constant STATE_SLOT = bytes32(uint256(keccak256("BridgingManagerUpgradeable.bridgingState")) - 1);

    /// @notice Initializes the contract to grant DEFAULT_ADMIN_ROLE to the admin_ address
    /// @dev This method might be called only once
    /// @param admin_ Address of the account to grant the DEFAULT_ADMIN_ROLE
    function __BridgingManagerUpgradeable_init(address admin_) internal onlyInitializing {
        State storage s = _loadState();
        if (s.isInitialized) {
            revert ErrorAlreadyInitialized();
        }
        __AccessControl_init();
        _setupRole(DEFAULT_ADMIN_ROLE, admin_);
        s.isInitialized = true;
        s.isDepositsEnabled = true;
        s.isWithdrawalsEnabled = true;
        emit InitializedBridgingManagerUpgradeable(admin_);
    }

    /// @notice Returns whether the contract is initialized or not
    function isInitialized() public view returns (bool) {
        return _loadState().isInitialized;
    }

    /// @notice Returns whether the deposits are enabled or not
    function isDepositsEnabled() public view returns (bool) {
        return _loadState().isDepositsEnabled;
    }

    /// @notice Returns whether the withdrawals are enabled or not
    function isWithdrawalsEnabled() public view returns (bool) {
        return _loadState().isWithdrawalsEnabled;
    }

    /// @notice Enables the deposits if they are disabled
    function enableDeposits() external onlyRole(DEPOSITS_ENABLER_ROLE) {
        if (isDepositsEnabled()) {
            revert ErrorDepositsEnabled();
        }
        _loadState().isDepositsEnabled = true;
        emit DepositsEnabled(msg.sender);
    }

    /// @notice Disables the deposits if they aren't disabled yet
    function disableDeposits() external whenDepositsEnabled onlyRole(DEPOSITS_DISABLER_ROLE) {
        _loadState().isDepositsEnabled = false;
        emit DepositsDisabled(msg.sender);
    }

    /// @notice Enables the withdrawals if they are disabled
    function enableWithdrawals() external onlyRole(WITHDRAWALS_ENABLER_ROLE) {
        if (isWithdrawalsEnabled()) {
            revert ErrorWithdrawalsEnabled();
        }
        _loadState().isWithdrawalsEnabled = true;
        emit WithdrawalsEnabled(msg.sender);
    }

    /// @notice Disables the withdrawals if they aren't disabled yet
    function disableWithdrawals() external whenWithdrawalsEnabled onlyRole(WITHDRAWALS_DISABLER_ROLE) {
        _loadState().isWithdrawalsEnabled = false;
        emit WithdrawalsDisabled(msg.sender);
    }

    /// @dev Returns the reference to the slot with State struct
    function _loadState() private pure returns (State storage r) {
        bytes32 slot = STATE_SLOT;
        assembly {
            r.slot := slot
        }
    }

    /// @dev Validates that deposits are enabled
    modifier whenDepositsEnabled() {
        if (!isDepositsEnabled()) {
            revert ErrorDepositsDisabled();
        }
        _;
    }

    /// @dev Validates that withdrawals are enabled
    modifier whenWithdrawalsEnabled() {
        if (!isWithdrawalsEnabled()) {
            revert ErrorWithdrawalsDisabled();
        }
        _;
    }

    event DepositsEnabled(address indexed enabler);
    event DepositsDisabled(address indexed disabler);
    event WithdrawalsEnabled(address indexed enabler);
    event WithdrawalsDisabled(address indexed disabler);
    event InitializedBridgingManagerUpgradeable(address indexed admin);

    error ErrorDepositsEnabled();
    error ErrorDepositsDisabled();
    error ErrorWithdrawalsEnabled();
    error ErrorWithdrawalsDisabled();
    error ErrorAlreadyInitialized();
}

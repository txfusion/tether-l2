// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/// @notice Contains administrative methods to retrieve and control the state of the bridging
contract ERC20FreezeManager is Initializable, AccessControlUpgradeable {
    event ERC20FreezeManager__AddressFrozen(address indexed freezer, address indexed frozen);
    event ERC20FreezeManager__AddressBurned(address indexed burner, address indexed burned);
    event ERC20FreezeManager__Initialized(address indexed admin);

    error ERC20FreezeManager__OnlyNotFrozenAddress(address user);
    error ERC20FreezeManager__OnlyFrozenAddress(address user);

    bytes32 public constant ADDRESS_FREEZER_ROLE = keccak256("ERC20FreezeManager.ADDRESS_FREEZER_ROLE");
    bytes32 public constant ADDRESS_BURNER_ROLE = keccak256("ERC20FreezeManager.ADDRESS_BURNER_ROLE");

    mapping(address => bool) internal s_frozenAddresses;

    /// @notice Initializes the contract to grant DEFAULT_ADMIN_ROLE to the admin_ address
    /// @dev This method might be called only once
    /// @param admin_ Address of the account to grant the DEFAULT_ADMIN_ROLE
    function __ERC20FreezeManager_init(address admin_) internal onlyInitializing {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);

        _setRoleAdmin(ADDRESS_FREEZER_ROLE, DEFAULT_ADMIN_ROLE);
        _grantRole(ADDRESS_FREEZER_ROLE, admin_);

        _setRoleAdmin(ADDRESS_BURNER_ROLE, DEFAULT_ADMIN_ROLE);
        _grantRole(ADDRESS_BURNER_ROLE, admin_);

        emit ERC20FreezeManager__Initialized(admin_);
    }

    modifier onlyNotFrozen(address user) {
        if (_isFrozen(user)) {
            revert ERC20FreezeManager__OnlyNotFrozenAddress(user);
        }
        _;
    }

    modifier onlyFrozen(address user) {
        if (!_isFrozen(user)) {
            revert ERC20FreezeManager__OnlyFrozenAddress(user);
        }
        _;
    }

    /// @notice Freeze the selected address.
    function freezeAddress(address toFreeze) external onlyRole(ADDRESS_FREEZER_ROLE) {
        s_frozenAddresses[toFreeze] = true;
    }

    /// @notice Unfreeze the selected address.
    function unfreezeAddress(address toUnfreeze) external onlyRole(ADDRESS_FREEZER_ROLE) {
        delete s_frozenAddresses[toUnfreeze];
    }

    /// @notice Check to see if the provided address is frozen.
    function _isFrozen(address toCheck) internal view returns (bool) {
        return s_frozenAddresses[toCheck];
    }
}

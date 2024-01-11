// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/// @notice Contains administrative methods to retrieve and control the state of the bridging
contract L2ERC20BridgeManager is Initializable, AccessControlUpgradeable {
    event L2ERC20BridgeManager__AddressFrozen(address indexed freezer, address indexed frozen);
    event L2ERC20BridgeManager__AddressBurned(address indexed burner, address indexed burned);
    event L2ERC20BridgeManager__Initialized(address indexed admin);

    error L2ERC20BridgeManager__NotFrozenAddress(address user);
    error L2ERC20BridgeManager__OnlyFrozenAddress(address user);

    bytes32 public constant ADDRESS_FREEZER_ROLE = keccak256("L2ERC20BridgeManager.ADDRESS_FREEZER_ROLE");
    bytes32 public constant ADDRESS_BURNER_ROLE = keccak256("L2ERC20BridgeManager.ADDRESS_BURNER_ROLE");

    mapping(address => bool) internal s_frozenAddresses;

    /// @notice Initializes the contract to grant DEFAULT_ADMIN_ROLE to the admin_ address
    /// @dev This method might be called only once
    /// @param admin_ Address of the account to grant the DEFAULT_ADMIN_ROLE
    function __L2ERC20BridgeManager_init(address admin_) internal onlyInitializing {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);

        _setRoleAdmin(ADDRESS_FREEZER_ROLE, DEFAULT_ADMIN_ROLE);
        _grantRole(ADDRESS_FREEZER_ROLE, admin_);

        _setRoleAdmin(ADDRESS_BURNER_ROLE, DEFAULT_ADMIN_ROLE);
        _grantRole(ADDRESS_BURNER_ROLE, admin_);

        emit L2ERC20BridgeManager__Initialized(admin_);
    }

    modifier onlyNotFrozen(address user) {
        if (isFrozen(user)) {
            revert L2ERC20BridgeManager__NotFrozenAddress(user);
        }
        _;
    }

    modifier onlyFrozen(address user) {
        if (!isFrozen(user)) {
            revert L2ERC20BridgeManager__OnlyFrozenAddress(user);
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
    function isFrozen(address toCheck) public view returns (bool) {
        return s_frozenAddresses[toCheck];
    }
}

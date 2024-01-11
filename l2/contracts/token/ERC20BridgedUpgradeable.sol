// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import {IERC20BridgedUpgradeable} from "../interfaces/IERC20BridgedUpgradeable.sol";

import {ERC20PermitUpgradeable} from "./ERC20PermitUpgradeable.sol";
import {ERC20MetadataUpgradeable} from "./ERC20MetadataUpgradeable.sol";

/// @notice Extends the ERC20Upgradeable functionality that allows the bridge to mint/burn tokens
contract ERC20BridgedUpgradeable is
    IERC20BridgedUpgradeable,
    ERC20PermitUpgradeable,
    ERC20MetadataUpgradeable
{
    /// @inheritdoc IERC20BridgedUpgradeable
    address public bridge;

    /// @param name_ The name of the token
    /// @param symbol_ The symbol of the token
    /// @param decimals_ The decimals places of the token
    function __ERC20BridgedUpgradeable_init(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address admin_
    ) external initializer {
        __ERC20Metadata_init_unchained(name_, symbol_, decimals_);
        __ERC20Permit_init(name_);
        __ERC20CoreUpgradeable_init(admin_);
    }

    /// @notice This function is used to integrate the previously deployed token with the bridge.
    /// @param bridge_ The bridge address which is allowed to mint/burn tokens
    function __ERC20BridgedUpgradeable_init_v2(
        address bridge_
    ) external reinitializer(2) {
        require(bridge_ != address(0), "Bridge address cannot be zero");
        bridge = bridge_;
    }

    /// @notice Check to see if the provided address is frozen.
    function isAddressFrozen(address toCheck) public view returns (bool) {
        return _isFrozen(toCheck);
    }

    /// @inheritdoc IERC20BridgedUpgradeable
    function bridgeMint(address account_, uint256 amount_) external onlyBridge {
        _mint(account_, amount_);
    }

    /// @inheritdoc IERC20BridgedUpgradeable
    function bridgeBurn(address account_, uint256 amount_) external onlyBridge {
        _burn(account_, amount_);
    }

    /// @dev Validates that sender of the transaction is the bridge
    modifier onlyBridge() {
        if (msg.sender != bridge) {
            revert ErrorNotBridge();
        }
        _;
    }

    error ErrorNotBridge();
}

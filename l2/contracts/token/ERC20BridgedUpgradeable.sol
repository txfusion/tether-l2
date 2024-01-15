// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IERC20BridgedUpgradeable} from "../interfaces/IERC20BridgedUpgradeable.sol";
import {ERC20CoreUpgradeable} from "./ERC20CoreUpgradeable.sol";
import {ERC20PermitUpgradeable} from "./ERC20PermitUpgradeable.sol";
import {ERC20MetadataUpgradeable} from "./ERC20MetadataUpgradeable.sol";
import {ERC20FreezeManager} from "./ERC20FreezeManager.sol";

/// @notice Extends the ERC20Upgradeable functionality that allows the bridge to mint/burn tokens
contract ERC20BridgedUpgradeable is
    IERC20BridgedUpgradeable,
    ERC20PermitUpgradeable,
    ERC20MetadataUpgradeable,
    ERC20FreezeManager
{
    error ErrorNotBridge();

    /// @dev burnedUser is the one who lost tokens and newTokenHolder is the one received them, so that the supply remains consistent.
    event BurnedFrozenTokens(
        address indexed burnedUser,
        address indexed newTokenHolder,
        uint256 amount
    );

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
        __ERC20FreezeManager_init(admin_);
    }

    /// @notice This function is used to integrate the previously deployed token with the bridge.
    /// @param bridge_ The bridge address which is allowed to mint/burn tokens
    function __ERC20BridgedUpgradeable_init_v2(
        address bridge_
    ) external reinitializer(2) {
        require(bridge_ != address(0), "Bridge address cannot be zero");
        bridge = bridge_;
    }

    /// @dev Validates that sender of the transaction is the bridge
    modifier onlyBridge() {
        if (msg.sender != bridge) {
            revert ErrorNotBridge();
        }
        _;
    }

    /// @notice Check to see if the provided address is frozen.
    function isAddressFrozen(address toCheck) public view returns (bool) {
        return _isFrozen(toCheck);
    }

    function transfer(
        address to_,
        uint256 amount_
    )
        public
        virtual
        override(IERC20Upgradeable, ERC20CoreUpgradeable)
        onlyNotFrozen(msg.sender)
        onlyNotFrozen(to_)
        returns (bool)
    {
        super.transfer(to_, amount_);
        return true;
    }

    function transferFrom(
        address from_,
        address to_,
        uint256 amount_
    )
        public
        virtual
        override(IERC20Upgradeable, ERC20CoreUpgradeable)
        onlyNotFrozen(from_)
        onlyNotFrozen(to_)
        returns (bool)
    {
        super.transferFrom(from_, to_, amount_);
        return true;
    }

    /// @inheritdoc IERC20BridgedUpgradeable
    /// @notice only unfrozen accounts can call this (within deposit)
    function bridgeMint(
        address account_,
        uint256 amount_
    ) external onlyBridge onlyNotFrozen(account_) {
        _mint(account_, amount_);
    }

    /// @inheritdoc IERC20BridgedUpgradeable
    /// @notice only unfrozen accounts can call this (within withdraw)
    function bridgeBurn(
        address account_,
        uint256 amount_
    ) external onlyBridge onlyNotFrozen(account_) {
        _burn(account_, amount_);
    }

    /**
     * @notice Allows admin to burn tokens from a frozen address and remint those tokens to an admin account, to preserve supply.
     * @dev The address should be previously frozen.
     * @param account_ account whose tokens will be burned
     */
    function burnFrozenTokens(address account_) external {
        _burnFrozenTokens(account_, msg.sender);
    }

    /**
     * @notice Allows admin to burn tokens from a frozen address and remint those tokens to an account of choice, to preserve supply.
     * @dev The address should be previously frozen.
     * @param account_ account whose tokens will be burned
     * @param burnEscrow_ account to which the tokens will be minted after burning
     */
    function burnFrozenTokensEscrow(
        address account_,
        address burnEscrow_
    ) external onlyNonZeroAccount(burnEscrow_) {
        _burnFrozenTokens(account_, burnEscrow_);
    }

    function _burnFrozenTokens(
        address account_,
        address burnEscrow_
    ) internal onlyRole(ADDRESS_BURNER_ROLE) onlyFrozen(account_) {
        uint256 amount = balanceOf[account_];

        _burn(account_, amount);
        _mint(burnEscrow_, amount);

        emit BurnedFrozenTokens(account_, burnEscrow_, amount);
    }
}

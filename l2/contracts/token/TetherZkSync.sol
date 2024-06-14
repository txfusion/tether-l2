// SPDX-License-Identifier: Apache 2.0

pragma solidity 0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {TetherTokenV2} from "./tether/TetherTokenV2.sol";
import {IERC20Bridged} from "./../../../common/interfaces/IERC20Bridged.sol";

contract TetherZkSync is Initializable, IERC20Bridged, TetherTokenV2, AccessControlUpgradeable {
    ///////////////////
    //    Errors     //
    //////////////////
    error TetherZkSync__InvalidBridgeAddress();

    ////////////////////////////
    //    State Variables     //
    ///////////////////////////
    address public bridge;

    bytes32 public constant BRIDGE_ROLE = keccak256("TetherZkSync.BRIDGE_ROLE");

    ///////////////////
    //    Events     //
    //////////////////
    event TetherZkSync__BridgeUpdated(address indexed oldBridge, address indexed newBridge);

    //////////////////////
    //    Modifiers     //
    /////////////////////
    /// @dev Validates that sender of the transaction is the bridge
    modifier onlyBridge() {
        _checkRole(BRIDGE_ROLE);
        _;
    }

    ////////////////////
    //  Initializer   //
    ///////////////////

    function __TetherZkSync_init(string memory _name, string memory _symbol, uint8 _decimals) external initializer {
        __TetherToken__init(_name, _symbol, _decimals);
        __EIP3009Upgradeable_init(_name);
    }

    /// @notice Connects the token with the bridge, after the bridge is deployed and connected to the token.
    /// @param bridge_ The address of the bridge.
    function __TetherZkSync_init_v2(address bridge_) external reinitializer(2) onlyOwner {
        _setBridge(bridge_);
    }

    ///////////////////////////////////////
    //     Public/External Functions     //
    ///////////////////////////////////////

    /// @notice Mints new tokens to the user during deposit to L2.
    /// @param account_ The address of the user who will receive newly minted tokens.
    /// @param amount_ The amount of tokens which will be minted.
    function bridgeMint(address account_, uint256 amount_)
        external
        override
        onlyBridge
        onlyNotBlockedAccount(account_)
    {
        _mint(account_, amount_);
    }

    /// @notice Burns the user's tokens during withdrawal from L2.
    /// @param account_ The address of the user whose tokens will be burnt.
    /// @param amount_ The amount of tokens which will be burnt.
    function bridgeBurn(address account_, uint256 amount_)
        external
        override
        onlyBridge
        onlyNotBlockedAccount(account_)
    {
        _burn(account_, amount_);
    }

    /// @notice Updates the bridge that can mint/burn the tokens during the bridging process.
    /// @param newBridge_ The address of the new bridge.
    function setBridge(address newBridge_) external onlyOwner {
        _setBridge(newBridge_);
    }

    ////////////////////////////////////////
    //     Private/Internal Functions     //
    ////////////////////////////////////////
    function _setBridge(address newBridge_) internal {
        address _oldBridge = bridge;
        if (_oldBridge != address(0)) {
            _revokeRole(BRIDGE_ROLE, _oldBridge);
        }

        bridge = newBridge_;
        _grantRole(BRIDGE_ROLE, newBridge_);

        emit TetherZkSync__BridgeUpdated(_oldBridge, newBridge_);
    }

    uint256[47] private __gap;
}

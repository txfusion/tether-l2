// SPDX-License-Identifier: Apache 2.0

pragma solidity 0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./tether/TetherTokenV2.sol";

contract TetherZkSync is Initializable, TetherTokenV2, AccessControlUpgradeable {
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
    /// @notice This function is used to integrate the previously deployed token with the bridge.
    /// @param bridge_ The bridge address which is allowed to mint/burn tokens
    function __TetherZkSync_init(string memory _name, string memory _symbol, uint8 _decimals, address bridge_)
        external
        initializer
    {
        _setBridge(bridge_);

        __TetherToken__init(_name, _symbol, _decimals);
        __EIP3009Upgradeable_init(_name);
    }

    ///////////////////////////////////////
    //     Public/External Functions     //
    ///////////////////////////////////////
    function bridgeMint(address account_, uint256 amount_) external onlyBridge onlyNotBlockedAccount(account_) {
        _mint(account_, amount_);
    }

    function bridgeBurn(address account_, uint256 amount_) external onlyBridge onlyNotBlockedAccount(account_) {
        _burn(account_, amount_);
    }

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
}

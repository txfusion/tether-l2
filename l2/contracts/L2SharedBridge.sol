// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IL1ERC20Bridge} from "@matterlabs/zksync-contracts/l2-contracts/contracts/bridge/interfaces/IL1ERC20Bridge.sol";
import {IL2SharedBridge} from
    "@matterlabs/zksync-contracts/l2-contracts/contracts/bridge/interfaces/IL2SharedBridge.sol";

import {AddressAliasHelper} from "@matterlabs/zksync-contracts/l2-contracts/contracts/vendor/AddressAliasHelper.sol";
import {L2ContractHelper} from "@matterlabs/zksync-contracts/l2-contracts/contracts/L2ContractHelper.sol";

import {BridgingManagerUpgradeable} from "../../common/BridgingManagerUpgradeable.sol";
import {BridgeableTokensUpgradable} from "../../common/BridgeableTokensUpgradable.sol";
import {TetherZkSync} from "./token/TetherZkSync.sol";

/// @notice The L2 token bridge works with the L1 token bridge to enable ERC20 token bridging
///     between L1 and L2. Mints tokens during deposits and burns tokens during withdrawals.
///     Additionally, adds the methods for bridging management: enabling and disabling withdrawals/deposits
contract L2SharedBridge is
    Initializable,
    IL2SharedBridge,
    BridgingManagerUpgradeable,
    BridgeableTokensUpgradable,
    OwnableUpgradeable
{
    /// @dev The address of the L1 shared bridge counterpart.
    address public override l1SharedBridge;

    uint256 internal immutable ERA_CHAIN_ID;

    /// @dev Contract is expected to be used as proxy implementation.
    /// @dev Disable the initialization to prevent Parity hack.
    constructor(uint256 _eraChainId) {
        ERA_CHAIN_ID = _eraChainId;
        // _disableInitializers();
    }

    /// @notice Initializes the bridge contract for later use. Expected to be used in the proxy.
    /// @param _l1SharedBridge The address of the L1 Bridge contract.
    /// @param _l1Token The address of the L1 token.
    /// @param _l2Token The address of the L1 token.
    /// @param _aliasedOwner The address of the governor contract.
    function initialize(address _l1SharedBridge, address _l1Token, address _l2Token, address _aliasedOwner)
        external
        initializer
        onlyNonZeroAddress(_l1SharedBridge)
        onlyNonZeroAddress(_l1Token)
        onlyNonZeroAddress(_l2Token)
        onlyNonZeroAddress(_aliasedOwner)
    {
        l1SharedBridge = _l1SharedBridge;

        __BridgingManagerUpgradeable_init(_aliasedOwner);

        __BridgeableTokens_init();
        _setL1Token(_l1Token);
        _setL2Token(_l2Token);

        __Ownable_init();
        transferOwnership(_aliasedOwner);
    }

    /// @notice Finalize the deposit and mint funds
    /// @param _l1Sender The account address that initiated the deposit on L1
    /// @param _l2Receiver The account address that would receive minted ether
    /// @param _l1Token The address of the token that was locked on the L1
    /// @param _amount Total amount of tokens deposited from L1
    function finalizeDeposit(address _l1Sender, address _l2Receiver, address _l1Token, uint256 _amount, bytes calldata)
        external
        override
        whenDepositsEnabled
        onlySupportedL1Token(_l1Token)
    {
        // Only the L1 bridge counterpart can initiate and finalize the deposit.
        require(AddressAliasHelper.undoL1ToL2Alias(msg.sender) == l1SharedBridge, "mq");

        address _l2Token = l2Token();

        TetherZkSync(_l2Token).bridgeMint(_l2Receiver, _amount);
        emit FinalizeDeposit(_l1Sender, _l2Receiver, _l2Token, _amount);
    }

    /// @notice Initiates a withdrawal by burning funds on the contract and sending the message to L1
    /// where tokens would be unlocked
    /// @param _l1Receiver The account address that should receive funds on L1
    /// @param _l2Token The L2 token address which is withdrawn
    /// @param _amount The total amount of tokens to be withdrawn
    function withdraw(address _l1Receiver, address _l2Token, uint256 _amount)
        external
        override
        onlySupportedL2Token(_l2Token)
    {
        require(_amount > 0, "Amount cannot be zero");

        TetherZkSync(_l2Token).bridgeBurn(msg.sender, _amount);

        bytes memory message = _getL1WithdrawMessage(_l1Receiver, _amount);
        L2ContractHelper.sendMessageToL1(message);

        emit WithdrawalInitiated(msg.sender, _l1Receiver, _l2Token, _amount);
    }

    function setL2Token(address l2Token_) external onlyOwner {
        _setL2Token(l2Token_);
    }

    /// @return Address of an L1 token counterpart
    function l1TokenAddress(address) public view override returns (address) {
        return l1Token();
    }

    /// @return Address of an L1 token counterpart
    function l1Bridge() public view override returns (address) {
        return address(0);
    }

    /// @return Address of an L2 token counterpart
    function l2TokenAddress(address) public view override returns (address) {
        return l2Token();
    }

    /// @dev Encode the message for l2ToL1log sent with withdraw initialization
    function _getL1WithdrawMessage(address _to, uint256 _amount) internal view returns (bytes memory) {
        // note we use the IL1ERC20Bridge.finalizeWithdrawal function selector to specify the selector for L1<>L2 messages,
        // and we use this interface so that when the switch happened the old messages could be processed
        return abi.encodePacked(IL1ERC20Bridge.finalizeWithdrawal.selector, _to, l1Token(), _amount);
    }
}

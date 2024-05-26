// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IL1ERC20Bridge} from "@matterlabs/zksync-contracts/l2-contracts/contracts/bridge/interfaces/IL1ERC20Bridge.sol";
import {IL2SharedBridge} from
    "@matterlabs/zksync-contracts/l2-contracts/contracts/bridge/interfaces/IL2SharedBridge.sol";
import {IL2StandardToken} from
    "@matterlabs/zksync-contracts/l2-contracts/contracts/bridge/interfaces/IL2StandardToken.sol";

import {L2StandardERC20} from "@matterlabs/zksync-contracts/l2-contracts/contracts/bridge/L2StandardERC20.sol";
import {AddressAliasHelper} from "@matterlabs/zksync-contracts/l2-contracts/contracts/vendor/AddressAliasHelper.sol";
import {
    L2ContractHelper,
    DEPLOYER_SYSTEM_CONTRACT,
    IContractDeployer
} from "@matterlabs/zksync-contracts/l2-contracts/contracts/L2ContractHelper.sol";
import {SystemContractsCaller} from "@matterlabs/zksync-contracts/l2-contracts/contracts/SystemContractsCaller.sol";

import {
    EmptyAddress,
    EmptyBytes32,
    InvalidCaller,
    AddressMismatch,
    AmountMustBeGreaterThanZero,
    DeployFailed
} from "@matterlabs/zksync-contracts/l2-contracts/contracts/L2ContractErrors.sol";

import {BridgingManagerUpgradeable} from "../../common/BridgingManagerUpgradeable.sol";
import {BridgeableTokensUpgradable} from "../../common/BridgeableTokensUpgradable.sol";

/// @notice The L2 token bridge works with the L1 token bridge to enable ERC20 token bridging
///     between L1 and L2. Mints tokens during deposits and burns tokens during withdrawals.
///     Additionally, adds the methods for bridging management: enabling and disabling withdrawals/deposits
contract L2ERC20Bridge is
    Initializable,
    IL2SharedBridge,
    BridgingManagerUpgradeable,
    BridgeableTokensUpgradable,
    OwnableUpgradeable
{
    /// @dev The address of the L1 bridge counterpart.
    address public override l1Bridge;

    /// @dev Contract that stores the implementation address for token.
    /// @dev For more details see https://docs.openzeppelin.com/contracts/3.x/api/proxy#UpgradeableBeacon.
    UpgradeableBeacon public l2TokenBeacon;

    /// @dev Bytecode hash of the proxy for tokens deployed by the bridge.
    bytes32 internal l2TokenProxyBytecodeHash;

    /// @dev A mapping l2 token address => l1 token address
    mapping(address l2TokenAddress => address l1TokenAddress) public override l1TokenAddress;

    address private l1LegacyBridge;

    uint256 internal immutable ERA_CHAIN_ID;

    /// @dev Contract is expected to be used as proxy implementation.
    /// @dev Disable the initialization to prevent Parity hack.
    constructor(uint256 _eraChainId) {
        ERA_CHAIN_ID = _eraChainId;
        _disableInitializers();
    }

    /// @notice Initializes the bridge contract for later use. Expected to be used in the proxy.
    /// @param _l1Bridge The address of the L1 Bridge contract.
    /// @param _l2Beacon The address of the
    /// @param _l2TokenProxyBytecodeHash The bytecode hash of the proxy for tokens deployed by the bridge.
    /// @param _aliasedOwner The address of the governor contract.
    function initialize(
        address _l1Bridge,
        address _l1LegacyBridge,
        address _l2Beacon,
        bytes32 _l2TokenProxyBytecodeHash,
        address _aliasedOwner
    ) external initializer onlyNonZeroAddress(_l1Bridge) {
        if (_l1Bridge == address(0)) {
            revert EmptyAddress();
        }

        if (_l2TokenProxyBytecodeHash == bytes32(0)) {
            revert EmptyBytes32();
        }

        if (_aliasedOwner == address(0)) {
            revert EmptyAddress();
        }

        l1Bridge = _l1Bridge;

        address _l2Token;
        if (block.chainid != ERA_CHAIN_ID) {
            address l2StandardToken = address(new L2StandardERC20{salt: bytes32(0)}());
            l2TokenBeacon = new UpgradeableBeacon{salt: bytes32(0)}(l2StandardToken);
            l2TokenProxyBytecodeHash = _l2TokenProxyBytecodeHash;
            l2TokenBeacon.transferOwnership(_aliasedOwner);
            _l2Token = address(l2TokenBeacon);
        } else {
            if (_l1LegacyBridge == address(0)) {
                revert EmptyAddress();
            }
            l1LegacyBridge = _l1LegacyBridge;
            // l2StandardToken and l2TokenBeacon are already deployed on ERA, and stored in the proxy
            // Note: `setL2Token` must be called in this case
        }

        __BridgeableTokens_init();
        __BridgingManagerUpgradeable_init(_aliasedOwner);
        __Ownable_init();
        _setL2Token(_l2Token);
        transferOwnership(_aliasedOwner);
    }

    /// @notice Finalize the deposit and mint funds
    /// @param _l1Sender The account address that initiated the deposit on L1
    /// @param _l2Receiver The account address that would receive minted ether
    /// @param _l1Token The address of the token that was locked on the L1
    /// @param _amount Total amount of tokens deposited from L1
    /// @param _data The additional data that user can pass with the deposit
    function finalizeDeposit(
        address _l1Sender,
        address _l2Receiver,
        address _l1Token,
        uint256 _amount,
        bytes calldata _data
    ) external override whenDepositsEnabled onlySupportedL1Token(_l1Token) {
        // Only the L1 bridge counterpart can initiate and finalize the deposit.
        if (
            AddressAliasHelper.undoL1ToL2Alias(msg.sender) != l1Bridge
                && AddressAliasHelper.undoL1ToL2Alias(msg.sender) != l1LegacyBridge
        ) {
            revert InvalidCaller(msg.sender);
        }

        address expectedL2Token = l2TokenAddress(_l1Token);
        address currentL1Token = l1TokenAddress[expectedL2Token];
        // Only if l1TokenAddress[expectedL2Token] hasn't been set
        if (currentL1Token == address(0)) {
            address deployedToken = _deployL2Token(_l1Token, _data); // TODO: Understand better
            if (deployedToken != expectedL2Token) {
                revert AddressMismatch(expectedL2Token, deployedToken);
            }

            l1TokenAddress[expectedL2Token] = _l1Token;
        } else {
            if (currentL1Token != _l1Token) {
                revert AddressMismatch(_l1Token, currentL1Token);
            }
        }

        IL2StandardToken(expectedL2Token).bridgeMint(_l2Receiver, _amount);
        emit FinalizeDeposit(_l1Sender, _l2Receiver, expectedL2Token, _amount);
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
        if (_amount == 0) {
            revert AmountMustBeGreaterThanZero();
        }

        IL2StandardToken(_l2Token).bridgeBurn(msg.sender, _amount);

        address l1Token = l1TokenAddress[_l2Token];
        if (l1Token == address(0)) {
            revert EmptyAddress();
        }

        bytes memory message = _getL1WithdrawMessage(_l1Receiver, l1Token, _amount);
        L2ContractHelper.sendMessageToL1(message);

        emit WithdrawalInitiated(msg.sender, _l1Receiver, _l2Token, _amount);
    }

    function setL2Token(address l2Token_) external onlyOwner {
        _setL2Token(l2Token_);
    }

    /// @dev Deploy and initialize the L2 token for the L1 counterpart
    function _deployL2Token(address _l1Token, bytes calldata _data) internal returns (address) {
        bytes32 salt = _getCreate2Salt(_l1Token);

        BeaconProxy l2Token = _deployBeaconProxy(salt);
        L2StandardERC20(address(l2Token)).bridgeInitialize(_l1Token, _data);

        return address(l2Token);
    }

    /// @dev Encode the message for l2ToL1log sent with withdraw initialization
    function _getL1WithdrawMessage(address _to, address _l1Token, uint256 _amount)
        internal
        pure
        returns (bytes memory)
    {
        // note we use the IL1ERC20Bridge.finalizeWithdrawal function selector to specify the selector for L1<>L2 messages,
        // and we use this interface so that when the switch happened the old messages could be processed
        return abi.encodePacked(IL1ERC20Bridge.finalizeWithdrawal.selector, _to, _l1Token, _amount);
    }

    /// @return Address of an L2 token counterpart
    function l2TokenAddress(address _l1Token) public view override returns (address) {
        bytes32 constructorInputHash = keccak256(abi.encode(address(l2TokenBeacon), ""));
        bytes32 salt = _getCreate2Salt(_l1Token);
        return
            L2ContractHelper.computeCreate2Address(address(this), salt, l2TokenProxyBytecodeHash, constructorInputHash);
    }

    /// @dev Convert the L1 token address to the create2 salt of deployed L2 token
    function _getCreate2Salt(address _l1Token) internal pure returns (bytes32 salt) {
        salt = bytes32(uint256(uint160(_l1Token)));
    }

    /// @dev Deploy the beacon proxy for the L2 token, while using ContractDeployer system contract.
    /// @dev This function uses raw call to ContractDeployer to make sure that exactly `l2TokenProxyBytecodeHash` is used
    /// for the code of the proxy.
    function _deployBeaconProxy(bytes32 salt) internal returns (BeaconProxy proxy) {
        (bool success, bytes memory returndata) = SystemContractsCaller.systemCallWithReturndata(
            uint32(gasleft()),
            DEPLOYER_SYSTEM_CONTRACT,
            0,
            abi.encodeCall(
                IContractDeployer.create2, (salt, l2TokenProxyBytecodeHash, abi.encode(address(l2TokenBeacon), ""))
            )
        );

        // The deployment should be successful and return the address of the proxy
        if (!success) {
            revert DeployFailed();
        }
        proxy = BeaconProxy(abi.decode(returndata, (address)));
    }
}

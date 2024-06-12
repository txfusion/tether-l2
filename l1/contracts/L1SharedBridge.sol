// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

// solhint-disable reason-string, gas-custom-errors

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IL1ERC20Bridge} from "@matterlabs/zksync-contracts/l1-contracts/contracts/bridge/interfaces/IL1ERC20Bridge.sol";
import {IL1SharedBridge} from
    "@matterlabs/zksync-contracts/l1-contracts/contracts/bridge/interfaces/IL1SharedBridge.sol";
import {IL2Bridge} from "@matterlabs/zksync-contracts/l1-contracts/contracts/bridge/interfaces/IL2Bridge.sol";

import {IMailbox} from
    "@matterlabs/zksync-contracts/l1-contracts/contracts/state-transition/chain-interfaces/IMailbox.sol";
import {L2Message, TxStatus} from "@matterlabs/zksync-contracts/l1-contracts/contracts/common/Messaging.sol";
import {UnsafeBytes} from "@matterlabs/zksync-contracts/l1-contracts/contracts/common/libraries/UnsafeBytes.sol";
import {ReentrancyGuard} from "@matterlabs/zksync-contracts/l1-contracts/contracts/common/ReentrancyGuard.sol";
import {AddressAliasHelper} from "@matterlabs/zksync-contracts/l1-contracts/contracts/vendor/AddressAliasHelper.sol";
import {
    ETH_TOKEN_ADDRESS,
    TWO_BRIDGES_MAGIC_VALUE
} from "@matterlabs/zksync-contracts/l1-contracts/contracts/common/Config.sol";
import {
    IBridgehub,
    L2TransactionRequestTwoBridgesInner,
    L2TransactionRequestDirect
} from "@matterlabs/zksync-contracts/l1-contracts/contracts/bridgehub/IBridgehub.sol";
import {IGetters} from
    "@matterlabs/zksync-contracts/l1-contracts/contracts/state-transition/chain-interfaces/IGetters.sol";
import {L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR} from
    "@matterlabs/zksync-contracts/l1-contracts/contracts/common/L2ContractAddresses.sol";

import {BridgeableTokensUpgradable} from "../../common/BridgeableTokensUpgradable.sol";
import {BridgingManagerUpgradeable} from "../../common/BridgingManagerUpgradeable.sol";

/// @notice Smart contract that allows depositing USDT tokens from Ethereum to hyperchains built on top of the ZK stack
/// @dev It is modified implementation of the Shared Bridge that can be used as a reference for any other custom token bridges.
contract L1SharedBridge is
    Initializable,
    IL1SharedBridge,
    ReentrancyGuard,
    Ownable2StepUpgradeable,
    PausableUpgradeable,
    BridgeableTokensUpgradable,
    BridgingManagerUpgradeable
{
    using SafeERC20 for IERC20;

    /// @dev Bridgehub smart contract that is used to operate with L2 via asynchronous L2 <-> L1 communication.
    IBridgehub public immutable override BRIDGE_HUB;

    /// @dev Era's chainID
    uint256 internal immutable ERA_CHAIN_ID;

    /// @dev The address of zkSync Era diamond proxy contract.
    address internal immutable ERA_DIAMOND_PROXY;

    /// @dev A mapping chainId => bridgeProxy. Used to store the bridge proxy's address, and to see if it has been deployed yet.
    mapping(uint256 chainId => address l2Bridge) public override l2BridgeAddress;

    /// @dev A mapping chainId => L2 deposit transaction hash => keccak256(abi.encode(account, tokenAddress, amount))
    /// @dev Tracks deposit transactions from L2 to enable users to claim their funds if a deposit fails.
    mapping(uint256 chainId => mapping(bytes32 l2DepositTxHash => bytes32 depositDataHash)) public override
        depositHappened;

    /// @dev Tracks the processing status of L2 to L1 messages, indicating whether a message has already been finalized.
    mapping(
        uint256 chainId => mapping(uint256 l2BatchNumber => mapping(uint256 l2ToL1MessageNumber => bool isFinalized))
    ) public isWithdrawalFinalized;

    /// @dev Indicates whether the hyperbridging is enabled for a given chain.
    // slither-disable-next-line uninitialized-state
    mapping(uint256 chainId => bool enabled) internal hyperbridgingEnabled;

    /// @dev Maps token balances for each chain to prevent unauthorized spending across hyperchains.
    /// This serves as a security measure until hyperbridging is implemented.
    /// NOTE: this function may be removed in the future, don't rely on it!
    mapping(uint256 chainId => mapping(address l1Token => uint256 balance)) public chainBalance;

    /// @notice Checks that the message sender is the bridgehub.
    modifier onlyBridgehub() {
        require(msg.sender == address(BRIDGE_HUB), "ShB not BH");
        _;
    }

    /// @notice Checks that the message sender is the bridgehub or zkSync Era Diamond Proxy.
    modifier onlyBridgehubOrEra(uint256 _chainId) {
        require(
            msg.sender == address(BRIDGE_HUB) || (_chainId == ERA_CHAIN_ID && msg.sender == ERA_DIAMOND_PROXY),
            "L1SharedBridge: not bridgehub or era chain"
        );
        _;
    }

    /// @dev Contract is expected to be used as proxy implementation.
    /// @dev Initialize the implementation to prevent Parity hack.
    constructor(
        address, // _l1WethAddress TODO: We can probably remove this, but in order to not lose our minds when we get to testing and deploying, let's keep it for now
        IBridgehub _bridgehub,
        uint256 _eraChainId,
        address _eraDiamondProxy
    ) reentrancyGuardInitializer {
        _disableInitializers();
        BRIDGE_HUB = _bridgehub;
        ERA_CHAIN_ID = _eraChainId;
        ERA_DIAMOND_PROXY = _eraDiamondProxy;
    }

    /// @dev Initializes a contract bridge for later use. Expected to be used in the proxy
    /// @param _owner Address which can change L2 token implementation and upgrade the bridge
    /// implementation. The owner is the Governor and separate from the ProxyAdmin from now on, so that the Governor can call the bridge.
    function initialize(address _owner, address _l1Token)
        external
        initializer
        onlyNonZeroAddress(_l1Token)
        onlyNonZeroAddress(_owner)
    {
        _transferOwnership(_owner);

        __BridgeableTokens_init();
        __BridgingManagerUpgradeable_init(_owner);

        _setL1Token(_l1Token);
    }

    function receiveEth(uint256 _chainId) external payable {
        require(BRIDGE_HUB.getHyperchain(_chainId) == msg.sender, "receiveEth not state transition");
    }

    /// @dev Initializes the l2Bridge address by governance for a specific chain.
    function initializeChainGovernance(uint256 _chainId, address _l2BridgeAddress) external onlyOwner {
        l2BridgeAddress[_chainId] = _l2BridgeAddress;
    }

    /// @notice Allows bridgehub to acquire mintValue for L1->L2 transactions.
    /// @dev If the corresponding L2 transaction fails, refunds are issued to a refund recipient on L2.
    function bridgehubDepositBaseToken(uint256 _chainId, address _prevMsgSender, address _l1Token, uint256 _amount)
        external
        payable
        virtual
        onlyBridgehubOrEra(_chainId)
        whenNotPaused
        whenDepositsEnabled
    {
        // Note: allow deposits of base tokens as well?
        require(BRIDGE_HUB.baseToken(_chainId) == _l1Token, "ShB: unrecognized baseToken for specified chainId");

        if (_l1Token == ETH_TOKEN_ADDRESS) {
            require(msg.value == _amount, "L1SharedBridge: msg.value not equal to amount");
        } else {
            // The Bridgehub also checks this, but we want to be sure
            require(msg.value == 0, "ShB m.v > 0 b d.it");

            uint256 amount = _depositFunds(_prevMsgSender, IERC20(_l1Token), _amount); // note if _prevMsgSender is this contract, this will return 0. This does not happen.
            require(amount == _amount, "3T"); // The token has non-standard transfer logic
        }

        if (!hyperbridgingEnabled[_chainId]) {
            chainBalance[_chainId][_l1Token] += _amount;
        }
        // Note that we don't save the deposited amount, as this is for the base token, which gets sent to the refundRecipient if the tx fails
        emit BridgehubDepositBaseTokenInitiated(_chainId, _prevMsgSender, _l1Token, _amount);
    }

    /// @dev Transfers tokens from the depositor address to the smart contract address.
    /// @return The difference between the contract balance before and after the transferring of funds.
    function _depositFunds(address _from, IERC20 _token, uint256 _amount) internal returns (uint256) {
        uint256 balanceBefore = _token.balanceOf(address(this));
        // slither-disable-next-line arbitrary-send-erc20
        _token.safeTransferFrom(_from, address(this), _amount);
        uint256 balanceAfter = _token.balanceOf(address(this));

        return balanceAfter - balanceBefore;
    }

    /// @notice Initiates a deposit transaction within Bridgehub, used by `requestL2TransactionTwoBridges`.
    function bridgehubDeposit(
        uint256 _chainId,
        address _prevMsgSender,
        // solhint-disable-next-line no-unused-vars
        uint256 _l2Value,
        bytes calldata _data
    )
        external
        payable
        override
        onlyBridgehub
        whenNotPaused
        whenDepositsEnabled
        returns (L2TransactionRequestTwoBridgesInner memory request)
    {
        require(l2BridgeAddress[_chainId] != address(0), "ShB l2 bridge not deployed");

        (address _l1Token, uint256 _depositAmount, address _l2Receiver) = abi.decode(_data, (address, uint256, address));

        require(BRIDGE_HUB.baseToken(_chainId) != _l1Token, "ShB: baseToken deposit not supported"); // TODO: Confirm if the check is needed
        require(_isL1TokenSupported(_l1Token), "ShB: unsupported L1 token");

        require(msg.value == 0, "ShB m.v > 0 for BH d.it 2");
        uint256 withdrawAmount = _depositFunds(_prevMsgSender, IERC20(_l1Token), _depositAmount);
        require(withdrawAmount == _depositAmount, "5T"); // The token has non-standard transfer logic
        require(_depositAmount != 0, "6T"); // empty deposit amount

        bytes32 txDataHash = keccak256(abi.encode(_prevMsgSender, _l1Token, _depositAmount));
        if (!hyperbridgingEnabled[_chainId]) {
            chainBalance[_chainId][_l1Token] += _depositAmount;
        }

        {
            // Request the finalization of the deposit on the L2 side
            bytes memory l2TxCalldata = _getDepositL2Calldata(_prevMsgSender, _l2Receiver, _l1Token, _depositAmount);

            request = L2TransactionRequestTwoBridgesInner({
                magicValue: TWO_BRIDGES_MAGIC_VALUE,
                l2Contract: l2BridgeAddress[_chainId],
                l2Calldata: l2TxCalldata,
                factoryDeps: new bytes[](0),
                txDataHash: txDataHash
            });
        }
        emit BridgehubDepositInitiated({
            chainId: _chainId,
            txDataHash: txDataHash,
            from: _prevMsgSender,
            to: _l2Receiver,
            l1Token: _l1Token,
            amount: _depositAmount
        });
    }

    /// @notice Confirms the acceptance of a transaction by the Mailbox, as part of the L2 transaction process within Bridgehub.
    /// This function is utilized by `requestL2TransactionTwoBridges` to validate the execution of a transaction.
    function bridgehubConfirmL2Transaction(uint256 _chainId, bytes32 _txDataHash, bytes32 _txHash)
        external
        override
        onlyBridgehub
        whenNotPaused
    {
        require(depositHappened[_chainId][_txHash] == 0x00, "ShB tx hap");
        depositHappened[_chainId][_txHash] = _txDataHash;
        emit BridgehubDepositFinalized(_chainId, _txDataHash, _txHash);
    }

    /// @dev Generate a calldata for calling the deposit finalization on the L2 bridge contract
    function _getDepositL2Calldata(address _l1Sender, address _l2Receiver, address _l1Token, uint256 _amount)
        internal
        view
        returns (bytes memory)
    {
        bytes memory gettersData = _getERC20Getters(_l1Token);
        return abi.encodeCall(IL2Bridge.finalizeDeposit, (_l1Sender, _l2Receiver, _l1Token, _amount, gettersData));
    }

    /// @dev Receives and parses (name, symbol, decimals) from the token contract
    function _getERC20Getters(address _token) internal view returns (bytes memory) {
        (, bytes memory data1) = _token.staticcall(abi.encodeCall(IERC20Metadata.name, ()));
        (, bytes memory data2) = _token.staticcall(abi.encodeCall(IERC20Metadata.symbol, ()));
        (, bytes memory data3) = _token.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
        return abi.encode(data1, data2, data3);
    }

    /// @dev Withdraw funds from the initiated deposit, that failed when finalizing on L2
    /// @param _depositSender The address of the deposit initiator
    /// @param _l1Token The address of the deposited L1 ERC20 token
    /// @param _amount The amount of the deposit that failed.
    /// @param _l2TxHash The L2 transaction hash of the failed deposit finalization
    /// @param _l2BatchNumber The L2 batch number where the deposit finalization was processed
    /// @param _l2MessageIndex The position in the L2 logs Merkle tree of the l2Log that was sent with the message
    /// @param _l2TxNumberInBatch The L2 transaction number in a batch, in which the log was sent
    /// @param _merkleProof The Merkle proof of the processing L1 -> L2 transaction with deposit finalization
    function claimFailedDeposit(
        uint256 _chainId,
        address _depositSender,
        address _l1Token,
        uint256 _amount,
        bytes32 _l2TxHash,
        uint256 _l2BatchNumber,
        uint256 _l2MessageIndex,
        uint16 _l2TxNumberInBatch,
        bytes32[] calldata _merkleProof
    ) external override {
        _claimFailedDeposit({
            _chainId: _chainId,
            _depositSender: _depositSender,
            _l1Token: _l1Token,
            _amount: _amount,
            _l2TxHash: _l2TxHash,
            _l2BatchNumber: _l2BatchNumber,
            _l2MessageIndex: _l2MessageIndex,
            _l2TxNumberInBatch: _l2TxNumberInBatch,
            _merkleProof: _merkleProof
        });
    }

    /// @dev Processes claims of failed deposit.
    function _claimFailedDeposit(
        uint256 _chainId,
        address _depositSender,
        address _l1Token,
        uint256 _amount,
        bytes32 _l2TxHash,
        uint256 _l2BatchNumber,
        uint256 _l2MessageIndex,
        uint16 _l2TxNumberInBatch,
        bytes32[] calldata _merkleProof
    ) internal nonReentrant whenNotPaused {
        {
            bool proofValid = BRIDGE_HUB.proveL1ToL2TransactionStatus({
                _chainId: _chainId,
                _l2TxHash: _l2TxHash,
                _l2BatchNumber: _l2BatchNumber,
                _l2MessageIndex: _l2MessageIndex,
                _l2TxNumberInBatch: _l2TxNumberInBatch,
                _merkleProof: _merkleProof,
                _status: TxStatus.Failure
            });
            require(proofValid, "yn");
        }
        require(_amount > 0, "y1");

        if (!hyperbridgingEnabled[_chainId]) {
            // check that the chain has sufficient balance
            require(chainBalance[_chainId][_l1Token] >= _amount, "ShB n funds");
            chainBalance[_chainId][_l1Token] -= _amount;
        }

        // Note: allow deposits of base tokens as well? if not, then add onlySupportedL1Token(_l1Token) modifier
        if (_l1Token == ETH_TOKEN_ADDRESS) {
            bool callSuccess;
            // Low-level assembly call, to avoid any memory copying (save gas)
            assembly {
                callSuccess := call(gas(), _depositSender, _amount, 0, 0, 0, 0)
            }
            require(callSuccess, "ShB: claimFailedDeposit failed");
        } else {
            IERC20(_l1Token).safeTransfer(_depositSender, _amount);
        }

        emit ClaimedFailedDepositSharedBridge(_chainId, _depositSender, _l1Token, _amount);
    }

    /// @notice Finalize the withdrawal and release funds
    /// @param _chainId The chain ID of the transaction to check
    /// @param _l2BatchNumber The L2 batch number where the withdrawal was processed
    /// @param _l2MessageIndex The position in the L2 logs Merkle tree of the l2Log that was sent with the message
    /// @param _l2TxNumberInBatch The L2 transaction number in the batch, in which the log was sent
    /// @param _message The L2 withdraw data, stored in an L2 -> L1 message
    /// @param _merkleProof The Merkle proof of the inclusion L2 -> L1 message about withdrawal initialization
    function finalizeWithdrawal(
        uint256 _chainId,
        uint256 _l2BatchNumber,
        uint256 _l2MessageIndex,
        uint16 _l2TxNumberInBatch,
        bytes calldata _message,
        bytes32[] calldata _merkleProof
    ) external override whenWithdrawalsEnabled {
        _finalizeWithdrawal({
            _chainId: _chainId,
            _l2BatchNumber: _l2BatchNumber,
            _l2MessageIndex: _l2MessageIndex,
            _l2TxNumberInBatch: _l2TxNumberInBatch,
            _message: _message,
            _merkleProof: _merkleProof
        });
    }

    struct MessageParams {
        uint256 l2BatchNumber;
        uint256 l2MessageIndex;
        uint16 l2TxNumberInBatch;
    }

    /// @dev Internal function that handles the logic for finalizing withdrawals.
    function _finalizeWithdrawal(
        uint256 _chainId,
        uint256 _l2BatchNumber,
        uint256 _l2MessageIndex,
        uint16 _l2TxNumberInBatch,
        bytes calldata _message,
        bytes32[] calldata _merkleProof
    ) internal nonReentrant whenNotPaused returns (address l1Receiver, address l1Token, uint256 amount) {
        require(!isWithdrawalFinalized[_chainId][_l2BatchNumber][_l2MessageIndex], "Withdrawal is already finalized");
        isWithdrawalFinalized[_chainId][_l2BatchNumber][_l2MessageIndex] = true;

        MessageParams memory messageParams = MessageParams({
            l2BatchNumber: _l2BatchNumber,
            l2MessageIndex: _l2MessageIndex,
            l2TxNumberInBatch: _l2TxNumberInBatch
        });
        (l1Receiver, l1Token, amount) = _checkWithdrawal(_chainId, messageParams, _message, _merkleProof);
        require(_isL1TokenSupported(l1Token), "ShB unsupported L1 token");

        if (!hyperbridgingEnabled[_chainId]) {
            // Check that the chain has sufficient balance
            require(chainBalance[_chainId][l1Token] >= amount, "ShB not enough funds 2"); // not enough funds
            chainBalance[_chainId][l1Token] -= amount;
        }

        // Note: allow withdrawal of base tokens as well? Won't work with _isL1TokenSupported() require
        if (l1Token == ETH_TOKEN_ADDRESS) {
            bool callSuccess;
            // Low-level assembly call, to avoid any memory copying (save gas)
            assembly {
                callSuccess := call(gas(), l1Receiver, amount, 0, 0, 0, 0)
            }
            require(callSuccess, "ShB: withdraw failed");
        } else {
            // Withdraw funds
            IERC20(l1Token).safeTransfer(l1Receiver, amount);
        }

        emit WithdrawalFinalizedSharedBridge(_chainId, l1Receiver, l1Token, amount);
    }

    /// @dev Verifies the validity of a withdrawal message from L2 and returns details of the withdrawal.
    function _checkWithdrawal(
        uint256 _chainId,
        MessageParams memory _messageParams,
        bytes calldata _message,
        bytes32[] calldata _merkleProof
    ) internal view returns (address l1Receiver, address l1Token, uint256 amount) {
        (l1Receiver, l1Token, amount) = _parseL2WithdrawalMessage(_chainId, _message);
        L2Message memory l2ToL1Message;
        {
            bool baseTokenWithdrawal = (l1Token == BRIDGE_HUB.baseToken(_chainId));
            address l2Sender = baseTokenWithdrawal ? L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR : l2BridgeAddress[_chainId];

            l2ToL1Message =
                L2Message({txNumberInBatch: _messageParams.l2TxNumberInBatch, sender: l2Sender, data: _message});
        }

        bool success = BRIDGE_HUB.proveL2MessageInclusion({
            _chainId: _chainId,
            _batchNumber: _messageParams.l2BatchNumber,
            _index: _messageParams.l2MessageIndex,
            _message: l2ToL1Message,
            _proof: _merkleProof
        });
        require(success, "ShB withd w proof"); // withdrawal wrong proof
    }

    function _parseL2WithdrawalMessage(uint256 _chainId, bytes memory _l2ToL1message)
        internal
        view
        returns (address l1Receiver, address l1Token, uint256 amount)
    {
        // We check that the message is long enough to read the data.
        // Please note that there are two versions of the message:
        // 1. The message that is sent by `withdraw(address _l1Receiver)`
        // It should be equal to the length of the bytes4 function signature + address l1Receiver + uint256 amount = 4 + 20 + 32 = 56 (bytes).
        // 2. The message that is sent by `withdrawWithMessage(address _l1Receiver, bytes calldata _additionalData)`
        // It should be equal to the length of the following:
        // bytes4 function signature + address l1Receiver + uint256 amount + address l2Sender + bytes _additionalData =
        // = 4 + 20 + 32 + 32 + _additionalData.length >= 68 (bytes).

        // So the data is expected to be at least 56 bytes long.
        require(_l2ToL1message.length >= 56, "ShB wrong msg len"); // wrong message length

        (uint32 functionSignature, uint256 offset) = UnsafeBytes.readUint32(_l2ToL1message, 0);
        if (bytes4(functionSignature) == IMailbox.finalizeEthWithdrawal.selector) {
            // this message is a base token withdrawal
            (l1Receiver, offset) = UnsafeBytes.readAddress(_l2ToL1message, offset);
            (amount, offset) = UnsafeBytes.readUint256(_l2ToL1message, offset);
            l1Token = BRIDGE_HUB.baseToken(_chainId);
        } else if (bytes4(functionSignature) == IL1ERC20Bridge.finalizeWithdrawal.selector) {
            // We use the IL1ERC20Bridge for backward compatibility with old withdrawals.

            // this message is a token withdrawal

            // Check that the message length is correct.
            // It should be equal to the length of the function signature + address + address + uint256 = 4 + 20 + 20 + 32 =
            // 76 (bytes).
            require(_l2ToL1message.length == 76, "ShB wrong msg len 2");
            (l1Receiver, offset) = UnsafeBytes.readAddress(_l2ToL1message, offset);
            (l1Token, offset) = UnsafeBytes.readAddress(_l2ToL1message, offset);
            (amount, offset) = UnsafeBytes.readUint256(_l2ToL1message, offset);
        } else {
            revert("ShB Incorrect message function selector");
        }
    }

    /*//////////////////////////////////////////////////////////////
                            ERA LEGACY FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /* 
    * NOTE: For Tether, there will not be a legacy bridge, as old USDT bridge and its tokens (and their L2 counterparts) 
    * will be treated as "bridged" USDT and the new ones (which will use this bridge) will be treated as "native ZKsync" USDT.
    * Functions related to the legacy bridge will be kept for SDK compatibility.
    */

    function depositLegacyErc20Bridge(address, address, address, uint256, uint256, uint256, address)
        external
        payable
        override
        nonReentrant
        returns (bytes32 l2TxHash)
    {
        l2TxHash = bytes32(0);
    }

    function finalizeWithdrawalLegacyErc20Bridge(uint256, uint256, uint16, bytes calldata, bytes32[] calldata)
        external
        pure
        override
        returns (address l1Receiver, address l1Token, uint256 amount)
    {
        (l1Receiver, l1Token, amount) = (address(0), address(0), 0);
    }

    function claimFailedDepositLegacyErc20Bridge(
        address,
        address,
        uint256,
        bytes32,
        uint256,
        uint256,
        uint16,
        bytes32[] calldata
    ) external pure override {}

    function L1_WETH_TOKEN() external pure override returns (address) {
        return address(0);
    }

    function legacyBridge() external pure override returns (IL1ERC20Bridge) {
        return IL1ERC20Bridge(address(0));
    }

    function setEraPostDiamondUpgradeFirstBatch(uint256) external override {}
    function setEraPostLegacyBridgeUpgradeFirstBatch(uint256) external override {}
    function setEraLegacyBridgeLastDepositTime(uint256, uint256) external override {}

    /*//////////////////////////////////////////////////////////////
                            PAUSE
    //////////////////////////////////////////////////////////////*/

    /// @notice Pauses all functions marked with the `whenNotPaused` modifier.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpauses the contract, allowing all functions marked with the `whenNotPaused` modifier to be called again.
    function unpause() external onlyOwner {
        _unpause();
    }

    function setL1Token(address _l1Token) external onlyOwner {
        _setL1Token(_l1Token);
    }
}

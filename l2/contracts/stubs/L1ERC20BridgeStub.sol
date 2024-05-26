// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IL2ERC20Bridge} from "../../../common/interfaces/IL2ERC20Bridge.sol";

contract L1ERC20BridgeStub {
    function deposit(
        address _l2Receiver,
        address _l1Token,
        uint256 _amount,
        uint256,
        uint256,
        address,
        address _l2Bridge,
        bytes memory data
    ) public payable {
        IL2ERC20Bridge(_l2Bridge).finalizeDeposit{value: msg.value}(msg.sender, _l2Receiver, _l1Token, _amount, data);
    }
}

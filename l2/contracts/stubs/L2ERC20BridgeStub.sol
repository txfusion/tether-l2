// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {IL1ERC20Bridge} from "../../../common/interfaces/IL1ERC20Bridge.sol";
import {IL2ERC20Bridge} from "../../../common/interfaces/IL2ERC20Bridge.sol";

contract L2ERC20BridgeStub is IL2ERC20Bridge {
    address public l1Bridge;
    address public l1Token;
    address public l2Token;
    address public admin;

    function initialize(address l1TokenBridge_, address l1Token_, address l2Token_, address admin_) external {
        require(l1Token_ != address(0), "L1 token address cannot be zero");
        require(l2Token_ != address(0), "L2 token address cannot be zero");
        l1Token = l1Token_;
        l2Token = l2Token_;
        l1Bridge = l1TokenBridge_;
        admin = admin_;
    }

    function finalizeDeposit(address l1Sender_, address l2Receiver_, address, uint256 amount_, bytes calldata)
        external
        payable
        override
    {
        emit FinalizeDeposit(l1Sender_, l2Receiver_, l2Token, amount_);
    }

    function withdraw(address l1Receiver_, address l2Token_, uint256 amount_) external {
        emit WithdrawalInitiated(msg.sender, l1Receiver_, l2Token_, amount_);
    }

    function l1TokenAddress(address) public view override returns (address) {
        return l1Token;
    }

    function l2TokenAddress(address) public view override returns (address) {
        return l2Token;
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

interface IL2ERC20Bridge {
    function initialize(
        address _l1TokenBridge,
        address _l1Token,
        address _l2Token,
        address _admin
    ) external;
}

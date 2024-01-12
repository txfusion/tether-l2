// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import {IERC20Bridged} from "../interfaces/IERC20Bridged.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20BridgedStub is IERC20Bridged, ERC20 {
    error OnlyNotFrozenAddress(address user);

    address public bridge;
    mapping(address => bool) frozenAddresses;

    constructor(
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
        _mint(msg.sender, 1000000 * 10 ** 18);
    }

    modifier onlyNotFrozen(address user) {
        if (frozenAddresses[user]) {
            revert OnlyNotFrozenAddress(user);
        }
        _;
    }

    function setBridge(address bridge_) external {
        bridge = bridge_;
    }

    function setFrozenStatus(address user_, bool status_) external {
        frozenAddresses[user_] = status_;
    }

    function bridgeMint(
        address account,
        uint256 amount
    ) external onlyNotFrozen(account) {
        _mint(account, amount);
    }

    function bridgeBurn(
        address account,
        uint256 amount
    ) external onlyNotFrozen(account) {
        _burn(account, amount);
    }

    function isAddressFrozen(address toCheck) external view returns (bool) {
        return frozenAddresses[toCheck];
    }
}

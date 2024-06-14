// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IERC20Bridged} from "../interfaces/IERC20Bridged.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20BridgedStub is IERC20Bridged, ERC20 {
    ////////////////////////////
    //    State Variables     //
    ///////////////////////////
    address public bridge;
    mapping(address => bool) public isBlocked;

    ///////////////////
    //    Events     //
    //////////////////
    event BlockPlaced(address indexed _user);
    event BlockReleased(address indexed _user);

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        _mint(msg.sender, 1000000 * 10 ** 18);
    }

    modifier onlyNotBlocked() {
        require(!isBlocked[_msgSender()], "Blocked: msg.sender is blocked");
        _;
    }

    modifier onlyNotBlockedAccount(address account_) {
        require(!isBlocked[account_], "Blocked: account is blocked");
        _;
    }

    function setBridge(address bridge_) external {
        bridge = bridge_;
    }

    function addToBlockedList(address _user) public {
        isBlocked[_user] = true;
        emit BlockPlaced(_user);
    }

    function removeFromBlockedList(address _user) public {
        isBlocked[_user] = false;
        emit BlockReleased(_user);
    }

    function bridgeMint(address account, uint256 amount) external onlyNotBlockedAccount(account) {
        _mint(account, amount);
    }

    function bridgeBurn(address account, uint256 amount) external onlyNotBlockedAccount(account) {
        _burn(account, amount);
    }
}

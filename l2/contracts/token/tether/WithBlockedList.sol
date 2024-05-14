// SPDX-License-Identifier: Apache 2.0

pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/*
   Copyright Tether.to 2020

   Author Will Harborne

   Licensed under the Apache License, Version 2.0
   http://www.apache.org/licenses/LICENSE-2.0
*/

contract WithBlockedList is OwnableUpgradeable {
    ////////////////////////////
    //    State Variables     //
    ///////////////////////////
    mapping(address => bool) public isBlocked;

    ///////////////////
    //    Events     //
    //////////////////
    event BlockPlaced(address indexed _user);
    event BlockReleased(address indexed _user);

    //////////////////////
    //    Modifiers     //
    /////////////////////
    /**
     * @notice Checks if the msg.sender has been blocked.
     */
    modifier onlyNotBlocked() {
        require(!isBlocked[_msgSender()], "Blocked: msg.sender is blocked");
        _;
    }

    /**
     * @notice Checks if the specified account has been blocked.
     * @param account_ Account to check
     */
    modifier onlyNotBlockedAccount(address account_) {
        require(!isBlocked[account_], "Blocked: account is blocked");
        _;
    }

    //////////////////////////////////////
    //    Public/External Functions     //
    /////////////////////////////////////
    function addToBlockedList(address _user) public onlyOwner {
        isBlocked[_user] = true;
        emit BlockPlaced(_user);
    }

    function removeFromBlockedList(address _user) public onlyOwner {
        isBlocked[_user] = false;
        emit BlockReleased(_user);
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

// This file is a workaround for Hardhat's artifacts. Hardhat creates artifacts only for declared contracts.
// So here we import those contracts that are needed only in offchain scripts.
import "../../common/proxy/OssifiableProxy.sol";

/// @notice Interfaces
import {IL1ERC20Bridge} from "../../common/interfaces/IL1ERC20Bridge.sol";
import {IL2ERC20Bridge} from "../../common/interfaces/IL2ERC20Bridge.sol";

/// @notice Stubs
import "../../common/stubs/EmptyContractStub.sol";
import "../../common/stubs/ERC20BridgedStub.sol";

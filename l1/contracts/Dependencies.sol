// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

// This file is a workaround for Hardhat's artifacts. Hardhat creates artifacts only for declared contracts.
// So here we import those contracts that are needed only in offchain scripts.
import "../../common/proxy/OssifiableProxy.sol";

/// @notice Stubs
import "../../common/stubs/EmptyContractStub.sol";
import "../../common/stubs/ERC20BridgedStub.sol";

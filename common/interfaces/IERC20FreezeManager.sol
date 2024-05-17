// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

interface IERC20FreezeManager {
    /// @notice Freeze the selected address.
    /// @param toFreeze user's address
    function freezeAddress(address toFreeze) external;

    /// @notice Unfreeze the selected address.
    /// @param toUnfreeze user's address
    function unfreezeAddress(address toUnfreeze) external;

    /// @notice Checks if the provided address has been frozen by the FreezeManager.
    /// @param toCheck user's address
    function isFrozen(address toCheck) external view returns (bool);
}

import { ethers } from "ethers";

/// ******************* Tether *******************
export const TETHER_CONSTANTS = {
  NAME: "Tether USD",
  SYMBOL: "USDT",
  DECIMALS: 6,
  L2_CONTRACT_NAME: "TetherZkSync",
};
/// **********************************************

/// ******************* zkSync *******************
export const SYSTEM_CONFIG_CONSTANTS = {
  REQUIRED_L2_GAS_PRICE_PER_PUBDATA: 800,
  ERA_CHAIN_ID: "270",
  ADDRESS_ONE: "0x0000000000000000000000000000000000000001",
  DEPLOYER_SYSTEM_CONTRACT_ADDRESS:
    "0x0000000000000000000000000000000000008006",
};

export const CREATE2_PREFIX = ethers.utils.solidityKeccak256(
  ["string"],
  ["zksyncCreate2"]
);

export const L1_TO_L2_ALIAS_OFFSET =
  "0x1111000000000000000000000000000000001111";
// ***********************************************

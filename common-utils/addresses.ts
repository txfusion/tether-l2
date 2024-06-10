import { ethers } from "ethers";

import { L1_TO_L2_ALIAS_OFFSET } from "./constants";
import { getAddressFromEnv } from "./env";

export interface DeployedAddresses {
  Bridgehub: {
    Proxy: string;
  };
  StateTransition: {
    DiamondProxy: string;
  };
  Bridges: {
    LegacyERC20BridgeProxy: string;
    L1SharedBridgeImplementation: string;
    L1SharedBridgeProxy: string;
    L2SharedBridgeImplementation: string;
    L2SharedBridgeProxy: string;
  };
  Tokens: {
    L1Token: string;
    L2Token: string;
  };
  BaseToken: string;
  TransparentProxyAdmin: string;
  Governance: string;
  Create2Factory: string;
}

export function deployedAddressesFromEnv(): DeployedAddresses {
  return {
    Bridgehub: {
      Proxy: getAddressFromEnv("CONTRACTS_BRIDGEHUB_PROXY_ADDR"),
    },
    StateTransition: {
      DiamondProxy: getAddressFromEnv("CONTRACTS_DIAMOND_PROXY_ADDR"),
    },
    Bridges: {
      LegacyERC20BridgeProxy: getAddressFromEnv(
        "CONTRACTS_L1_ERC20_BRIDGE_PROXY_ADDR"
      ),
      L1SharedBridgeImplementation: getAddressFromEnv(
        "CONTRACTS_L1_SHARED_BRIDGE_IMPL_ADDR"
      ),
      L1SharedBridgeProxy: getAddressFromEnv(
        "CONTRACTS_L1_SHARED_BRIDGE_PROXY_ADDR"
      ),
      L2SharedBridgeImplementation: getAddressFromEnv(
        "CONTRACTS_L2_SHARED_BRIDGE_IMPL_ADDR"
      ),
      L2SharedBridgeProxy: getAddressFromEnv(
        "CONTRACTS_L2_SHARED_BRIDGE_PROXY_ADDR"
      ),
    },
    Tokens: {
      L1Token: getAddressFromEnv("CONTRACTS_L1_TOKEN_ADDR"),
      L2Token: getAddressFromEnv("CONTRACTS_L2_TOKEN_PROXY_ADDR"),
    },
    BaseToken: getAddressFromEnv("CONTRACTS_BASE_TOKEN_ADDR"),
    TransparentProxyAdmin: getAddressFromEnv(
      "CONTRACTS_TRANSPARENT_PROXY_ADMIN_ADDR"
    ),
    Governance: getAddressFromEnv("CONTRACTS_GOVERNANCE_ADDR"),
    Create2Factory: getAddressFromEnv("CONTRACTS_CREATE2_FACTORY_ADDR"),
  };
}

export function applyL1ToL2Alias(address: string): string {
  return ethers.getAddress(
    `0x${
      (BigInt(ethers.getAddress(address)) + BigInt(L1_TO_L2_ALIAS_OFFSET)) %
      BigInt(2) ** BigInt(160)
    }`
  );
}

// export function applyL1ToL2Alias(address: string): string {
//   return ethers.hexlify(
//     ethers.BigNumber.from(address)
//       .add(L1_TO_L2_ALIAS_OFFSET)
//       .mod(ethers.BigNumber.from(2).pow(160))
//   );
// }

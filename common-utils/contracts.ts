import { ethers } from "ethers";

import {
  ERC20Token,
  ERC20Token__factory,
  L1SharedBridge,
  L1SharedBridge__factory,
} from "./../l1/typechain";
import {
  L2SharedBridge,
  L2SharedBridge__factory,
  TetherZkSync,
  TetherZkSync__factory,
} from "./../l2/typechain";
import { deployedAddressesFromEnv } from "./addresses";

export function defaultL1Bridge(
  signerOrProvider: ethers.Signer | ethers.providers.Provider
): L1SharedBridge {
  return L1SharedBridge__factory.connect(
    deployedAddressesFromEnv().Bridges.L1SharedBridgeProxy,
    signerOrProvider
  );
}

export function defaultL2Bridge(
  signerOrProvider: ethers.Signer | ethers.providers.Provider
): L2SharedBridge {
  return L2SharedBridge__factory.connect(
    deployedAddressesFromEnv().Bridges.L2SharedBridgeProxy,
    signerOrProvider
  );
}

export function tetherTokenL1(
  signerOrProvider: ethers.Signer | ethers.providers.Provider
): ERC20Token {
  return ERC20Token__factory.connect(
    deployedAddressesFromEnv().Tokens.L1Token,
    signerOrProvider
  );
}

export function tetherTokenL2(
  signerOrProvider: ethers.Signer | ethers.providers.Provider
): TetherZkSync {
  return TetherZkSync__factory.connect(
    deployedAddressesFromEnv().Tokens.L2Token,
    signerOrProvider
  );
}

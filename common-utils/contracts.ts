import { ethers } from "ethers";
import { Wallet } from "zksync-ethers";

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
  signerOrProvider: ethers.Wallet | Wallet | ethers.Signer | ethers.Provider
): L1SharedBridge {
  return L1SharedBridge__factory.connect(
    deployedAddressesFromEnv().Bridges.L1SharedBridgeProxy,
    signerOrProvider
  );
}

export function defaultL2Bridge(
  signerOrProvider: ethers.Wallet | Wallet | ethers.Signer | ethers.Provider
): L2SharedBridge {
  return L2SharedBridge__factory.connect(
    deployedAddressesFromEnv().Bridges.L2SharedBridgeProxy,
    signerOrProvider
  );
}

export function tetherTokenL1(
  signerOrProvider: ethers.Wallet | Wallet | ethers.Signer | ethers.Provider
): ERC20Token {
  return ERC20Token__factory.connect(
    deployedAddressesFromEnv().Tokens.L2Token,
    signerOrProvider
  );
}

export function tetherTokenL2(
  signerOrProvider: ethers.Wallet | Wallet | ethers.Signer | ethers.Provider
): TetherZkSync {
  return TetherZkSync__factory.connect(
    deployedAddressesFromEnv().Tokens.L2Token,
    signerOrProvider
  );
}

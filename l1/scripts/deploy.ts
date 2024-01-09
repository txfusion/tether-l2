import { run as hardhatRun } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { Signer, Wallet, providers } from "ethers";
import { getAddressFromEnv } from "./utils/utils";
import { IZkSyncFactory } from "zksync-web3/build/typechain";
import { L1ERC20Bridge__factory } from "../typechain/factories/l1/contracts/L1ERC20Bridge__factory";

export const IS_PRODUCTION = (process.env.NODE_ENV as string) === "prod";
export const IS_LOCAL = (process.env.NODE_ENV as string) === "local";

export interface DeployedAddresses {
  zkSync: {
    diamondProxy: string;
  };
  bridges: {
    l1BridgeImplementation: string;
    l1BridgeProxy: string;
    l2BridgeProxy: string;
  };
  l1Token: string;
  l2Token: string;
}

export interface DeployerConfig {
  deployWallet: Wallet;
  governorAddress?: string;
  verbose?: boolean;
}

export function deployedAddressesFromEnv(): DeployedAddresses {
  return {
    zkSync: {
      diamondProxy: getAddressFromEnv("CONTRACTS_DIAMOND_PROXY_ADDR"),
    },
    bridges: {
      l1BridgeImplementation: getAddressFromEnv(
        "CONTRACTS_L1_BRIDGE_IMPLEMENTATION_ADDR"
      ),
      l1BridgeProxy: getAddressFromEnv("CONTRACTS_L1_BRIDGE_PROXY_ADDR"),
      l2BridgeProxy: getAddressFromEnv("CONTRACTS_L2_BRIDGE_PROXY_ADDR"),
    },
    l1Token: getAddressFromEnv("CONTRACTS_L1_TOKEN_ADDR"),
    l2Token: getAddressFromEnv("CONTRACTS_L2_TOKEN_PROXY_ADDR"),
  };
}

export class Deployer {
  public addresses: DeployedAddresses;
  private deployWallet: Wallet;
  private verbose: boolean;
  private governorAddress: string;

  constructor(config: DeployerConfig) {
    this.deployWallet = config.deployWallet;
    this.verbose = config.verbose != null ? config.verbose : false;
    this.addresses = deployedAddressesFromEnv();
    this.governorAddress =
      config.governorAddress != null
        ? config.governorAddress
        : this.deployWallet.address;
  }

  public zkSyncContract(signerOrProvider: Signer | providers.Provider) {
    return IZkSyncFactory.connect(
      this.addresses.zkSync.diamondProxy,
      signerOrProvider
    );
  }

  public defaultL1Bridge(signerOrProvider: Signer | providers.Provider) {
    return L1ERC20Bridge__factory.connect(
      this.addresses.bridges.l1BridgeProxy,
      signerOrProvider
    );
  }

  public verifyContract(address: string, constructorArguments?: any[]) {
    if (!IS_LOCAL) {
      if (this.verbose) {
        console.log("Verifying contract...");
      }
      setTimeout(() => {
        hardhatRun("verify:verify", {
          address,
          constructorArguments,
        });
      }, 1_000);
    }
  }
}

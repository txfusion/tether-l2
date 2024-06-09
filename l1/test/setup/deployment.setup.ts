import { JsonRpcProvider } from "@ethersproject/providers";
import { Wallet } from "ethers";
import { Provider, Wallet as ZkWallet } from "zksync-ethers";
import {
  L1ERC20Bridge__factory,
  // TransparentUpgradeableProxy__factory,
  OssifiableProxy__factory,
} from "../../typechain";
import {
  L2ERC20Bridge__factory,
  TetherZkSync__factory,
} from "../../../l2/typechain";

import { ZKSYNC_ADDRESSES } from "./../utils/utils";
import { IZkSyncFactory } from "zksync-ethers/build/typechain";

const ETH_CLIENT_WEB3_URL = process.env.ETH_CLIENT_WEB3_URL as string;
const CONTRACTS_DIAMOND_PROXY_ADDR = process.env
  .CONTRACTS_DIAMOND_PROXY_ADDR as string;

export async function setup() {
  const {
    l1: { l1Bridge },
    l2: { l2Token, l2Bridge },
  } = ZKSYNC_ADDRESSES;

  const zkProvider = zkSyncProvider();
  const ethProvider = new JsonRpcProvider(ETH_CLIENT_WEB3_URL);

  const ethDeployer = new Wallet(
    process.env.PRIVATE_KEY as string,
    ethProvider
  );

  const deployer = new ZkWallet(process.env.PRIVATE_KEY as string, zkProvider);

  return {
    l1: {
      proxy: {
        l1Bridge: new OssifiableProxy__factory(ethDeployer).attach(l1Bridge),
      },
      l1Bridge: new L1ERC20Bridge__factory(ethDeployer).attach(l1Bridge),
      zkSync: IZkSyncFactory.connect(CONTRACTS_DIAMOND_PROXY_ADDR, ethDeployer),
      accounts: {
        deployer: ethDeployer,
      },
    },
    l2: {
      proxy: {
        l2Token: new OssifiableProxy__factory(deployer).attach(l2Token),
        l2Bridge: new OssifiableProxy__factory(deployer).attach(l2Bridge),
      },
      // CONTRACTS
      l2Token: new TetherZkSync__factory(deployer).attach(l2Token),
      l2Bridge: new L2ERC20Bridge__factory(deployer).attach(l2Bridge),
      accounts: {
        deployer,
      },
    },
    depositsEnabled: {
      l1: true,
      l2: true,
    },
    withdrawalsEnabled: {
      l1: true,
      l2: true,
    },
    zkProvider,
    ethProvider,
    accounts: {
      deployer: ethDeployer,
    },
  };
}

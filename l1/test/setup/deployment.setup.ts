import { Wallet } from "ethers";
import { Wallet as ZkWallet } from "zksync-ethers";
import {
  PRIVATE_KEY,
  defaultL1Bridge,
  defaultL2Bridge,
  ethereumProvider,
  tetherTokenL2,
  zkSyncProvider,
} from "../../../common-utils";

export async function setup() {
  const ethProvider = ethereumProvider();
  const zkProvider = zkSyncProvider();

  const ethDeployer = new Wallet(PRIVATE_KEY as string, ethProvider);
  const deployer = new ZkWallet(PRIVATE_KEY as string, zkProvider, ethProvider);

  return {
    l1: {
      l1Bridge: defaultL1Bridge(ethDeployer),
      zkSync: deployer.getBridgehubContract(),
      accounts: {
        deployer: ethDeployer,
      },
    },
    l2: {
      l2Token: tetherTokenL2(deployer),
      l2Bridge: defaultL2Bridge(deployer),
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

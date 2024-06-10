import { Wallet as ZkWallet } from "zksync-ethers";
import { Wallet, utils } from "ethers";
import {
  PRIVATE_KEY,
  defaultL1Bridge,
  defaultL2Bridge,
  deployedAddressesFromEnv,
  ethereumProvider,
  tetherTokenL1,
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
      l1Token: tetherTokenL1(ethDeployer),
      l1Bridge: defaultL1Bridge(ethDeployer),
      bridgehub: deployer.getBridgehubContract(),
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
    zkProvider,
    ethProvider,
    depositAmount: utils.parseEther("0.025"),
    withdrawalAmount: utils.parseEther("0.025"),
    gasLimit: 10_000_000,
    ADDRESSES: deployedAddressesFromEnv(),
  };
}

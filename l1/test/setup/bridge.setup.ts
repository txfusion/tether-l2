import { JsonRpcProvider } from "@ethersproject/providers";
import { Wallet } from "ethers";
import { Provider, Wallet as ZkWallet } from "zksync-ethers";
import { L1ERC20Bridge__factory, ERC20Token__factory } from "../../typechain";
import {
  ERC20BridgedUpgradeable__factory,
  L2ERC20Bridge__factory,
} from "../../../l2/typechain";
import { ZKSYNC_ADDRESSES } from "./../utils/utils";
import { parseEther } from "ethers/lib/utils";
import { IZkSyncFactory } from "zksync-ethers/build/typechain";

const PRIVATE_KEY = process.env.PRIVATE_KEY as string;
const ETH_CLIENT_WEB3_URL = process.env.ETH_CLIENT_WEB3_URL as string;
const ZKSYNC_PROVIDER_URL = process.env.ZKSYNC_PROVIDER_URL as string;
const CONTRACTS_DIAMOND_PROXY_ADDR = process.env
  .CONTRACTS_DIAMOND_PROXY_ADDR as string;

export async function setup() {
  const { l1, l2 } = ZKSYNC_ADDRESSES;

  const zkProvider = new Provider(ZKSYNC_PROVIDER_URL);
  const ethProvider = new JsonRpcProvider(ETH_CLIENT_WEB3_URL);

  const ethDeployer = new Wallet(PRIVATE_KEY as string, ethProvider);
  const deployer = new ZkWallet(PRIVATE_KEY as string, zkProvider, ethProvider);

  return {
    l1: {
      l1Token: new ERC20Token__factory(ethDeployer).attach(l1.l1Token),
      l1Bridge: new L1ERC20Bridge__factory(ethDeployer).attach(l1.l1Bridge),
      zkSync: IZkSyncFactory.connect(CONTRACTS_DIAMOND_PROXY_ADDR, ethDeployer),
      accounts: {
        deployer: ethDeployer,
      },
    },
    l2: {
      l2Token: new ERC20BridgedUpgradeable__factory(deployer).attach(
        l2.l2Token
      ),
      l2Bridge: new L2ERC20Bridge__factory(deployer).attach(l2.l2Bridge),
      accounts: {
        deployer,
      },
    },
    zkProvider,
    ethProvider,
    depositAmount: parseEther("0.025"),
    withdrawalAmount: parseEther("0.025"),
    gasLimit: 10_000_000,
  };
}

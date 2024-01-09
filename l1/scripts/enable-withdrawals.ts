import * as hre from "hardhat";
import { web3Provider } from "./utils/utils";
import { Wallet } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import { Deployer } from "./deploy";

// typechain
import { L1ERC20Bridge__factory } from "../typechain";

// L2
import { Wallet as ZkSyncWallet, Provider, utils, Contract } from "zksync-web3";
import { L2ERC20Bridge__factory } from "../../l2/typechain";

const PRIVATE_KEY = process.env.PRIVATE_KEY as string;
const ZKSYNC_PROVIDER_URL = process.env.ZKSYNC_PROVIDER_URL as string;

const provider = web3Provider();
const zkProvider = new Provider(ZKSYNC_PROVIDER_URL);

async function main() {
  const deployWallet = new Wallet(PRIVATE_KEY, provider);

  const zkWallet = new ZkSyncWallet(PRIVATE_KEY, zkProvider);

  console.log(`Using deployer wallet: ${deployWallet.address}`);

  const gasPrice = await provider.getGasPrice();

  console.log(`Using gas price: ${formatUnits(gasPrice, "gwei")} gwei`);

  const deployer = new Deployer({
    deployWallet,
    governorAddress: deployWallet.address,
    verbose: true,
  });

  const l1Bridge = deployer.defaultL1Bridge(deployWallet);

  const zkSync = deployer.zkSyncContract(deployWallet);

  const L1ERC20BridgeAbi = L1ERC20Bridge__factory.abi;

  const IL1ERC20Bridge = new hre.ethers.utils.Interface(L1ERC20BridgeAbi);

  const l2Bridge = L2ERC20Bridge__factory.connect(
    deployer.addresses.bridges.l2BridgeProxy,
    zkWallet
  );

  const isWithdrawalEnabledOnL1 = await l1Bridge.isWithdrawalsEnabled();
  const isWithdrawalEnabledOnL2 = await l2Bridge.isWithdrawalsEnabled();

  if (isWithdrawalEnabledOnL1 && isWithdrawalEnabledOnL2) {
    console.log("\n================================");
    console.log("\nWithdrawals on L1 and L2 bridges are already enabled!");
    console.log("\n================================");
    return;
  }

  console.log("\n===============L1===============");

  if (!isWithdrawalEnabledOnL1) {
    const data = IL1ERC20Bridge.encodeFunctionData("enableWithdrawals", []);
    const enableWithdrawalsTx = await L1GovernorAgent.execute(
      l1Bridge.address,
      0,
      data,
      {
        gasLimit: 10_000_000,
      }
    );

    await enableWithdrawalsTx.wait();
  }

  console.log(
    "\nWITHDRAWALS ENABLED ON L1 BRIDGE:",
    await l1Bridge.isWithdrawalsEnabled()
  );

  console.log("\n===============L2===============");

  console.log(
    "\nWITHDRAWALS ENABLED ON L2 BRIDGE:",
    await l2Bridge.isWithdrawalsEnabled()
  );
}

main().catch((error) => {
  throw error;
});

import { web3Provider } from "./utils/utils";
import { Wallet } from "ethers";
import { formatUnits } from "ethers/lib/utils";

import { Deployer } from "./deploy";

// L2
import { Wallet as ZkSyncWallet, Provider } from "zksync-web3";
import { L2ERC20Bridge__factory } from "../../l2/typechain";

const PRIVATE_KEY = process.env.PRIVATE_KEY as string;
const ZKSYNC_PROVIDER_URL = process.env.ZKSYNC_PROVIDER_URL as string;

const provider = web3Provider();
const zkProvider = new Provider(ZKSYNC_PROVIDER_URL);

async function main() {
  const deployWallet = new Wallet(PRIVATE_KEY, provider);
  const zkWallet = new ZkSyncWallet(PRIVATE_KEY, zkProvider);

  const gasPrice = await provider.getGasPrice();

  const deployer = new Deployer({
    deployWallet,
    governorAddress: deployWallet.address,
    verbose: true,
  });

  const l1Bridge = deployer.defaultL1Bridge(deployWallet);

  console.log(`Using deployer wallet: ${deployWallet.address}`);
  console.log(`Using gas price: ${formatUnits(gasPrice, "gwei")} gwei`);
  console.log(`Using L1 Bridge: ${l1Bridge.address}`);

  const l2Bridge = L2ERC20Bridge__factory.connect(
    deployer.addresses.bridges.l2BridgeProxy,
    zkWallet
  );

  const isDepositEnabledOnL1 = await l1Bridge.isDepositsEnabled();
  const isDepositEnabledOnL2 = await l2Bridge.isDepositsEnabled();

  if (!isDepositEnabledOnL1 && !isDepositEnabledOnL2) {
    console.log("\n================================");
    console.log("\nDeposits on L1 and L2 bridges are already disabled!");
    console.log("\n================================");
    return;
  }

  console.log("\n===============L1===============");

  if (isDepositEnabledOnL1) {
    const disableDepositsTx = await l2Bridge.disableDeposits();
    await disableDepositsTx.wait();
  }

  console.log(
    "\nDEPOSITS DISABLED ON L1 BRIDGE:",
    !(await l1Bridge.isDepositsEnabled())
  );

  console.log("\n===============L2===============");

  if (isDepositEnabledOnL2) {
    const disableDepositsTx = await l2Bridge.disableDeposits({
      gasLimit: 10_000_000,
    });
    await disableDepositsTx.wait();
  }

  console.log(
    "\nDEPOSITS DISABLED ON L2 BRIDGE:",
    !(await l2Bridge.isDepositsEnabled())
  );
}

main().catch((error) => {
  throw error;
});

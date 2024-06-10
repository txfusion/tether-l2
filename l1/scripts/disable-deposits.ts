import { Wallet as ZkSyncWallet, Provider } from "zksync-ethers";
import { Wallet } from "ethers";
import { formatUnits } from "ethers/lib/utils";

import {
  PRIVATE_KEY,
  defaultL1Bridge,
  defaultL2Bridge,
  ethereumProvider,
  zkSyncProvider,
} from "./../../common-utils";

const provider = ethereumProvider();
const zkProvider = zkSyncProvider();

async function main() {
  const deployWallet = new Wallet(PRIVATE_KEY, provider);
  const zkWallet = new ZkSyncWallet(PRIVATE_KEY, zkProvider);

  const gasPrice = await provider.getGasPrice();

  const l1Bridge = defaultL1Bridge(deployWallet);
  const l2Bridge = defaultL2Bridge(zkWallet);

  console.log(`Using L1 wallet: ${deployWallet.address}`);
  console.log(`Using L2 wallet: ${zkWallet.address}`);
  console.log(`Using gas price: ${formatUnits(gasPrice, "gwei")} gwei`);
  console.log(`Using L1 Bridge: ${l1Bridge.address}`);
  console.log(`Using L2 Bridge: ${l2Bridge.address}`);

  const isDepositEnabledOnL1 = await l1Bridge.isDepositsEnabled();
  const isDepositEnabledOnL2 = await l2Bridge.isDepositsEnabled();

  if (!isDepositEnabledOnL1 && !isDepositEnabledOnL2) {
    console.log("\n=======================================================");
    console.log("\n Deposits on L1 and L2 bridges are already disabled! \n");
    console.log("=======================================================\n");
    return;
  }

  console.log("\n====================== L1 ======================");

  if (isDepositEnabledOnL1) {
    console.log("Deposits are currently enabled on L1, disabling...");
    const disableDepositsTx = await l1Bridge.disableDeposits({
      gasLimit: 10_000_000,
    });
    await disableDepositsTx.wait();
  }

  console.log(
    "Are deposits disabled on the L1 bridge?",
    !(await l1Bridge.isDepositsEnabled())
  );
  console.log("================================================");

  console.log("\n====================== L2 ======================");

  if (isDepositEnabledOnL2) {
    console.log("Deposits are currently enabled on L2, disabling...");
    const disableDepositsTx = await l2Bridge.disableDeposits({
      gasLimit: 10_000_000,
    });
    await disableDepositsTx.wait();
  }
  console.log(
    "Are deposits disabled on the L2 bridge?",
    !(await l2Bridge.isDepositsEnabled())
  );

  console.log("================================================");
}

main().catch((error) => {
  throw error;
});

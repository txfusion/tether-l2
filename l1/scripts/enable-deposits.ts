import { Wallet as ZkSyncWallet, Provider } from "zksync-ethers";
import { ethers } from "ethers";

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
  const deployWallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const zkWallet = new ZkSyncWallet(PRIVATE_KEY, zkProvider, provider);

  const gasPrice = await provider.getGasPrice();

  const l1Bridge = defaultL1Bridge(deployWallet);
  const l2Bridge = defaultL2Bridge(zkWallet);

  console.log(`Using L1 wallet: ${deployWallet.address}`);
  console.log(`Using L2 wallet: ${zkWallet.address}`);
  console.log(
    `Using gas price: ${ethers.utils.formatUnits(gasPrice, "gwei")} gwei`
  );
  console.log(`Using L1 Bridge: ${l1Bridge.address}`);
  console.log(`Using L2 Bridge: ${l2Bridge.address}`);

  const isDepositEnabledOnL1 = await l1Bridge.isDepositsEnabled();
  const isDepositEnabledOnL2 = await l2Bridge.isDepositsEnabled();

  if (isDepositEnabledOnL1 && isDepositEnabledOnL2) {
    console.log("\n=======================================================");
    console.log("\n Deposits on L1 and L2 bridges are already enabled! \n");
    console.log("=======================================================\n");
    return;
  }

  console.log("\n====================== L1 ======================");

  if (!isDepositEnabledOnL1) {
    console.log("Deposits are currently disabled on L1, enabling...");
    const enableDepositsTx = await l1Bridge.enableDeposits({
      gasLimit: 10_000_000,
    });
    await enableDepositsTx.wait();
  }

  console.log(
    "Are deposits enabled on the L1 bridge?",
    await l1Bridge.isDepositsEnabled()
  );
  console.log("================================================");

  console.log("\n====================== L2 ======================");

  if (!isDepositEnabledOnL2) {
    console.log("Deposits are currently disabled on L2, enabling...");
    const enableDepositsTx = await l2Bridge.enableDeposits({
      gasLimit: 10_000_000,
    });
    await enableDepositsTx.wait();
  }
  console.log(
    "Are deposits enabled on the L2 bridge?",
    await l2Bridge.isDepositsEnabled()
  );

  console.log("================================================");
}

main().catch((error) => {
  throw error;
});

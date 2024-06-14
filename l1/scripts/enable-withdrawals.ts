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

  const isWithdrawalEnabledOnL1 = await l1Bridge.isWithdrawalsEnabled();
  const isWithdrawalEnabledOnL2 = await l2Bridge.isWithdrawalsEnabled();

  if (isWithdrawalEnabledOnL1 && isWithdrawalEnabledOnL2) {
    console.log("\n=======================================================");
    console.log("\n Withdrawals on L1 and L2 bridges are already enabled! \n");
    console.log("=======================================================\n");
    return;
  }

  console.log("\n====================== L1 ======================");

  if (!isWithdrawalEnabledOnL1) {
    console.log("Withdrawals are currently disabled on L1, enabling...");
    const enableWithdrawalsTx = await l1Bridge.enableWithdrawals({
      gasLimit: 10_000_000,
    });
    await enableWithdrawalsTx.wait();
  }

  console.log(
    "Are withdrawals enabled on the L1 bridge?",
    await l1Bridge.isWithdrawalsEnabled()
  );
  console.log("================================================");

  console.log("\n====================== L2 ======================");

  if (!isWithdrawalEnabledOnL2) {
    console.log("Withdrawals are currently disabled on L2, enabling...");
    const enableWithdrawalsTx = await l2Bridge.enableWithdrawals({
      gasLimit: 10_000_000,
    });
    await enableWithdrawalsTx.wait();
  }
  console.log(
    "Are withdrawals enabled on the L2 bridge?",
    await l2Bridge.isWithdrawalsEnabled()
  );

  console.log("================================================");
}

main().catch((error) => {
  throw error;
});

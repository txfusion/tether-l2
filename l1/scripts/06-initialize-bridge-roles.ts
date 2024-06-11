import { Wallet as ZkSyncWallet, Provider, Contract } from "zksync-ethers";
import { Wallet } from "ethers";
import { formatUnits } from "ethers/lib/utils";

import { Deployer } from "./utils/deployer";
import { HASHES, grantRole } from "./utils/roles";

import {
  PRIVATE_KEY,
  defaultL1Bridge,
  defaultL2Bridge,
  ethereumProvider,
  zkSyncProvider,
} from "../../common-utils";

const provider = ethereumProvider();
const zkProvider = zkSyncProvider();

async function main() {
  const deployWallet = new Wallet(PRIVATE_KEY, provider);
  const zkWallet = new ZkSyncWallet(PRIVATE_KEY, zkProvider);

  console.log(`Using deployer wallet: ${deployWallet.address}`);

  const gasPrice = await provider.getGasPrice();

  console.log(`Using gas price: ${formatUnits(gasPrice, "gwei")} gwei`);

  console.log("\n=============== L1 ===============");
  const l1Bridge = defaultL1Bridge(deployWallet);
  console.log(`Setting up roles on the L1 Bridge ('${l1Bridge.address}')\n`);

  await grantRole(
    l1Bridge,
    HASHES.ROLES.DEPOSITS_ENABLER_ROLE,
    "DEPOSITS_ENABLER_ROLE",
    [deployWallet.address],
    true
  );

  await grantRole(
    l1Bridge,
    HASHES.ROLES.DEPOSITS_DISABLER_ROLE,
    "DEPOSITS_DISABLER_ROLE",
    [deployWallet.address],
    true
  );

  await grantRole(
    l1Bridge,
    HASHES.ROLES.WITHDRAWALS_ENABLER_ROLE,
    "WITHDRAWALS_ENABLER_ROLE",
    [deployWallet.address],
    true
  );

  await grantRole(
    l1Bridge,
    HASHES.ROLES.WITHDRAWALS_DISABLER_ROLE,
    "WITHDRAWALS_DISABLER_ROLE",
    [deployWallet.address],
    true
  );
  console.log("==================================");

  console.log("\n=============== L2 ===============");
  const l2Bridge = defaultL2Bridge(zkWallet);
  console.log(
    `> Setting up roles on the L2 Bridge ('${l2Bridge.address}')...\n`
  );

  await grantRole(
    l2Bridge,
    HASHES.ROLES.DEPOSITS_ENABLER_ROLE,
    "DEPOSITS_ENABLER_ROLE",
    [deployWallet.address],
    true
  );

  await grantRole(
    l2Bridge,
    HASHES.ROLES.DEPOSITS_DISABLER_ROLE,
    "DEPOSITS_DISABLER_ROLE",
    [deployWallet.address],
    true
  );

  await grantRole(
    l2Bridge,
    HASHES.ROLES.WITHDRAWALS_ENABLER_ROLE,
    "WITHDRAWALS_ENABLER_ROLE",
    [deployWallet.address],
    true
  );

  await grantRole(
    l2Bridge,
    HASHES.ROLES.WITHDRAWALS_DISABLER_ROLE,
    "WITHDRAWALS_DISABLER_ROLE",
    [deployWallet.address],
    true
  );
  console.log("==================================\n");

  console.log("Roles on both bridges have been initialized.\n");
}

main().catch((error) => {
  throw error;
});

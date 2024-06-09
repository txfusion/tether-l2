import { Wallet as ZkSyncWallet, Provider, Contract } from "zksync-ethers";
import { Wallet } from "ethers";
import { formatUnits } from "ethers/lib/utils";

import { Deployer } from "./utils/deployer";
import { HASHES } from "./utils/hashes";

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
    [deployWallet.address]
  );

  await grantRole(
    l1Bridge,
    HASHES.ROLES.DEPOSITS_DISABLER_ROLE,
    "DEPOSITS_DISABLER_ROLE",
    [deployWallet.address]
  );

  await grantRole(
    l1Bridge,
    HASHES.ROLES.WITHDRAWALS_ENABLER_ROLE,
    "WITHDRAWALS_ENABLER_ROLE",
    [deployWallet.address]
  );

  await grantRole(
    l1Bridge,
    HASHES.ROLES.WITHDRAWALS_DISABLER_ROLE,
    "WITHDRAWALS_DISABLER_ROLE",
    [deployWallet.address]
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
    [deployWallet.address]
  );

  await grantRole(
    l2Bridge,
    HASHES.ROLES.DEPOSITS_DISABLER_ROLE,
    "DEPOSITS_DISABLER_ROLE",
    [deployWallet.address]
  );

  await grantRole(
    l2Bridge,
    HASHES.ROLES.WITHDRAWALS_ENABLER_ROLE,
    "WITHDRAWALS_ENABLER_ROLE",
    [deployWallet.address]
  );

  await grantRole(
    l2Bridge,
    HASHES.ROLES.WITHDRAWALS_DISABLER_ROLE,
    "WITHDRAWALS_DISABLER_ROLE",
    [deployWallet.address]
  );
  console.log("==================================\n");

  console.log("Roles on both bridges have been initialized.\n");
}

/**
 * grantRole
 */
async function grantRole(
  contract: Contract,
  roleBytecode: string,
  roleName: string,
  targets: string[]
) {
  for (const target of targets) {
    const hasL2ExecutorDepositDisablerRoleL2 = await contract.hasRole(
      roleBytecode,
      target
    );

    if (!hasL2ExecutorDepositDisablerRoleL2) {
      const tx = await contract.grantRole(roleBytecode, target, {
        gasLimit: 10_000_000,
      });
      await tx.wait();

      const isRoleGranted = await contract.hasRole(roleBytecode, target);

      if (!isRoleGranted) {
        console.warn(`Error granting ${roleName} to ${target}`);
        return;
      }
    }
    console.log(`${roleName}:${target}`);
  }
}

/**
 * revokeRole
 */
async function revokeRole(
  contract: Contract,
  roleBytecode: string,
  roleName: string,
  target: string
) {
  const hasRole = await contract.hasRole(roleBytecode, target);

  if (hasRole) {
    const tx = await contract.revokeRole(roleBytecode, target, {
      gasLimit: 10_000_000,
    });
    await tx.wait();

    const hadRole = await contract.hasRole(roleBytecode, target);
    if (!hadRole) {
      console.log(`Revoked ${roleName}: ${target}`);
    }
  }
  console.log(`${target} doesn't possess ${roleName}`);
}

main().catch((error) => {
  throw error;
});

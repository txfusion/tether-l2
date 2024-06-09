import { Wallet as ZkSyncWallet, Provider, Contract } from "zksync-ethers";
import { Wallet } from "ethers";
import { formatUnits } from "ethers/lib/utils";

import { Deployer } from "./utils/deployer";
import { HASHES } from "./utils/hashes";

import {
  PRIVATE_KEY,
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

  const deployer = new Deployer({
    deployWallet,
    verbose: true,
  });

  const l1Bridge = deployer.defaultL1Bridge(deployWallet);
  const l2Bridge = deployer.defaultL2Bridge(deployWallet);

  console.log("\n===============L1===============");
  console.log(`Using L1 Bridge: ${l1Bridge.address}`);

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

  console.log("\n===============L2===============");
  console.log(`Using L2 Bridge: ${l2Bridge.address}`);

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

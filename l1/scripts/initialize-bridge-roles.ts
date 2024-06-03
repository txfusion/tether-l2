import { Wallet as ZkSyncWallet, Provider, Contract } from "zksync-ethers";
import { Wallet } from "ethers";
import { formatUnits } from "ethers/lib/utils";

import { web3Provider } from "./utils/utils";
import { Deployer } from "./deploy";

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

  console.log(`Using L1 Bridge: ${l1Bridge.address}`);

  const l2Bridge = L2ERC20Bridge__factory.connect(
    deployer.addresses.bridging.l2BridgeProxy,
    zkWallet
  );

  console.log(`Using L2 Bridge: ${l2Bridge.address}`);

  // get bytecode for roles
  const DEPOSITS_ENABLER_ROLE =
    "0x4b43b36766bde12c5e9cbbc37d15f8d1f769f08f54720ab370faeb4ce893753a";
  const DEPOSITS_DISABLER_ROLE =
    "0x63f736f21cb2943826cd50b191eb054ebbea670e4e962d0527611f830cd399d6";
  const WITHDRAWALS_ENABLER_ROLE =
    "0x9ab8816a3dc0b3849ec1ac00483f6ec815b07eee2fd766a353311c823ad59d0d";
  const WITHDRAWALS_DISABLER_ROLE =
    "0x94a954c0bc99227eddbc0715a62a7e1056ed8784cd719c2303b685683908857c";

  console.log("\n===============L1===============");

  await grantRole(l1Bridge, DEPOSITS_ENABLER_ROLE, "DEPOSITS_ENABLER_ROLE", [
    deployWallet.address,
  ]);

  await grantRole(l1Bridge, DEPOSITS_DISABLER_ROLE, "DEPOSITS_DISABLER_ROLE", [
    deployWallet.address,
  ]);

  await grantRole(
    l1Bridge,
    WITHDRAWALS_ENABLER_ROLE,
    "WITHDRAWALS_ENABLER_ROLE",
    [deployWallet.address]
  );

  await grantRole(
    l1Bridge,
    WITHDRAWALS_DISABLER_ROLE,
    "WITHDRAWALS_DISABLER_ROLE",
    [deployWallet.address]
  );

  console.log("\n===============L2===============");

  await grantRole(l2Bridge, DEPOSITS_ENABLER_ROLE, "DEPOSITS_ENABLER_ROLE", [
    deployWallet.address,
  ]);

  await grantRole(l2Bridge, DEPOSITS_DISABLER_ROLE, "DEPOSITS_DISABLER_ROLE", [
    deployWallet.address,
  ]);

  await grantRole(
    l2Bridge,
    WITHDRAWALS_ENABLER_ROLE,
    "WITHDRAWALS_ENABLER_ROLE",
    [deployWallet.address]
  );

  await grantRole(
    l2Bridge,
    WITHDRAWALS_DISABLER_ROLE,
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

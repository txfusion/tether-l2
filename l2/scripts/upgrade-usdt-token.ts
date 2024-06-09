import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet } from "zksync-ethers";
import * as hre from "hardhat";
import {
  PRIVATE_KEY,
  TETHER_CONSTANTS,
  deployedAddressesFromEnv,
  verifyContract,
} from "../../common-utils";

export async function main() {
  console.info("~~~ Upgrading " + TETHER_CONSTANTS.L2_CONTRACT_NAME + " ~~~");

  const deployer = new Deployer(hre, new Wallet(PRIVATE_KEY));

  const newERC20Bridged = await hre.zkUpgrades.upgradeProxy(
    deployer.zkWallet,
    deployedAddressesFromEnv().Tokens.L2Token,
    await deployer.loadArtifact(TETHER_CONSTANTS.L2_CONTRACT_NAME) // TODO: Add new upgraded artifact's name
  );

  // TODO: Initialize new implementation

  console.log(`~~~ New USDT implementation has been deployed ~~~`);
  verifyContract(newERC20Bridged.address);

  return newERC20Bridged.address;
}

main().catch((error) => {
  throw error;
});

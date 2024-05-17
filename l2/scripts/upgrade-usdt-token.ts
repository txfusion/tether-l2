import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet } from "zksync-ethers";
import * as hre from "hardhat";

import {
  ADDRESSES,
  ERC20_BRIDGED_CONSTANTS,
  PRIVATE_KEY,
} from "./utils/constants";
import { verify } from "./utils/verify";

export async function main() {
  console.info(
    "~~~ Upgrading " + ERC20_BRIDGED_CONSTANTS.CONTRACT_NAME + " ~~~"
  );

  const deployer = new Deployer(hre, new Wallet(PRIVATE_KEY));

  const newERC20Bridged = await hre.zkUpgrades.upgradeProxy(
    deployer.zkWallet,
    ADDRESSES.L2_TOKEN_ADDR,
    await deployer.loadArtifact(ERC20_BRIDGED_CONSTANTS.CONTRACT_NAME) // TODO: Add new upgraded artifact
  );

  // TODO: Initialize new implementation

  console.log(`~~~ New USDT implementation has been deployed ~~~`);
  await verify(newERC20Bridged.address);

  return newERC20Bridged.address;
}

main().catch((error) => {
  throw error;
});

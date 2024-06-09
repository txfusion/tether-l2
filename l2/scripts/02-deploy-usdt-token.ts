import * as hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet } from "zksync-ethers";

import {
  PRIVATE_KEY,
  TETHER_CONSTANTS,
  verifyContract,
} from "./../../common-utils";

async function main() {
  const deployer = new Deployer(hre, new Wallet(PRIVATE_KEY));

  console.log("~~~ Deploying Proxy ~~~");

  const constructorParams = [
    TETHER_CONSTANTS.NAME,
    TETHER_CONSTANTS.SYMBOL,
    TETHER_CONSTANTS.DECIMALS,
  ];
  const erc20Bridged = await hre.zkUpgrades.deployProxy(
    deployer.zkWallet,
    await deployer.loadArtifact(TETHER_CONSTANTS.L2_CONTRACT_NAME),
    constructorParams,
    { initializer: "__TetherZkSync_init" },
    false
  );

  console.log(`CONTRACTS_L2_TOKEN_PROXY_ADDR=${erc20Bridged.address}`);
  verifyContract(erc20Bridged.address, constructorParams);

  console.log("~~~ Proxy deployed and initialized ~~~");
}

main().catch((error) => {
  throw error;
});

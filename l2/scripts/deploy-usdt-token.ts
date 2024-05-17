import * as hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet } from "zksync-ethers";

import {
  ADDRESSES,
  ERC20_BRIDGED_CONSTANTS,
  PRIVATE_KEY,
} from "./utils/constants";
import { verify } from "./utils/verify";

async function main() {
  const deployer = new Deployer(hre, new Wallet(PRIVATE_KEY));

  console.log("~~~ Deploying Proxy ~~~");
  const erc20Bridged = await hre.zkUpgrades.deployProxy(
    deployer.zkWallet,
    await deployer.loadArtifact(ERC20_BRIDGED_CONSTANTS.CONTRACT_NAME),
    [
      ERC20_BRIDGED_CONSTANTS.NAME,
      ERC20_BRIDGED_CONSTANTS.SYMBOL,
      ERC20_BRIDGED_CONSTANTS.DECIMALS,
    ],
    { initializer: "__TetherZkSync_init" },
    false
  );

  // console.log(
  //   `CONTRACTS_L2_TOKEN_IMPLEMENTATION_ADDR=${await erc20Bridged.implementation()}`
  // );
  // await verify(await erc20Bridged.implementation());

  console.log(`CONTRACTS_L2_TOKEN_PROXY_ADDR=${erc20Bridged.address}`);
  await verify(erc20Bridged.address);

  console.log("~~~ Proxy deployed and initialized ~~~");
}

main().catch((error) => {
  throw error;
});

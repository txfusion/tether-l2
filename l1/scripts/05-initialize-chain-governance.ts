import { Wallet } from "ethers";
import { Deployer } from "./utils/deployer";
import {
  CHAIN_ID,
  PRIVATE_KEY,
  defaultL1Bridge,
  ethereumProvider,
} from "../../common-utils";

async function main() {
  const deployWallet = new Wallet(PRIVATE_KEY, ethereumProvider());

  const deployer = new Deployer({
    deployWallet,
    verbose: true,
  });

  const l1SharedBridge = defaultL1Bridge(deployer.deployWallet);

  console.log("Initializing chain governance...");

  await l1SharedBridge.initializeChainGovernance(
    CHAIN_ID,
    deployer.addresses.Bridges.L2SharedBridgeProxy
  );
  console.log(
    "L2 shared bridge address registered on L1 directly via the owner."
  );

  // await deployer.executeUpgradeViaGovernance(
  //   l1SharedBridge.address,
  //   0,
  //   l1SharedBridge.interface.encodeFunctionData("initializeChainGovernance", [
  //     chainId,
  //     deployer.addresses.Bridges.L2SharedBridgeProxy,
  //   ])
  // );
  // console.log("L2 shared bridge address registered on L1 via governance.");
}

main().catch((error) => {
  throw error;
});

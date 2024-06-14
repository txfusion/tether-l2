import { Wallet } from "ethers";
import { Deployer } from "./utils/deployer";
import {
  CHAIN_ID,
  IS_LOCAL,
  PRIVATE_KEY,
  ethereumProvider,
} from "../../common-utils";

const provider = ethereumProvider();

async function main() {
  const deployer = new Deployer({
    deployWallet: new Wallet(PRIVATE_KEY, provider),
    verbose: true,
  });

  const gasPrice = await provider.getGasPrice();

  await deployer.deploySharedBridgeImplOnL2ThroughL1(
    CHAIN_ID,
    gasPrice,
    IS_LOCAL
  );
  await deployer.deploySharedBridgeProxyOnL2ThroughL1(CHAIN_ID, gasPrice);
}

main().catch((error) => {
  throw error;
});

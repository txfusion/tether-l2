import * as hre from "hardhat";
import { Wallet, utils } from "zksync-ethers";

import { Deployer } from "./utils/deployer";
import {
  PRIVATE_KEY,
  defaultL2Bridge,
  tetherTokenL2,
  zkSyncProvider,
} from "../../common-utils";

const provider = zkSyncProvider();

async function main() {
  const deployer = new Deployer({
    deployWallet: new Wallet(PRIVATE_KEY, provider),
    verbose: true,
  });

  const tokenContract = tetherTokenL2(deployer.deployWallet);

  const connectedBridgeAddress = await tokenContract.bridge();
  if (connectedBridgeAddress !== hre.ethers.constants.AddressZero) {
    throw new Error("Token is already connected to the bridge");
  }

  const gasPrice = await provider.getGasPrice();

  await (
    await tokenContract.__TetherZkSync_init_v2(
      defaultL2Bridge(deployer.deployWallet).address,
      {
        maxFeePerGas: gasPrice,
        maxPriorityFeePerGas: 0,
        gasLimit: 10_000_000,
        customData: {
          gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
        },
      }
    )
  ).wait(1);

  console.log(
    `Connected bridge address that can mint/burn tokens: ${await tokenContract.bridge()}`
  );
}

main().catch((error) => {
  throw error;
});

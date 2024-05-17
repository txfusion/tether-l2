import * as hre from "hardhat";

import { Wallet, Provider, Contract, utils } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
  ADDRESSES,
  ERC20_BRIDGED_CONSTANTS,
  PRIVATE_KEY,
  ZKSYNC_PROVIDER_URL,
} from "./utils/constants";

function getToken(hre: HardhatRuntimeEnvironment, wallet: Wallet): Contract {
  const artifact = hre.artifacts.readArtifactSync(
    ERC20_BRIDGED_CONSTANTS.CONTRACT_NAME
  );
  return new Contract(ADDRESSES.L2_TOKEN_ADDR, artifact.abi, wallet);
}

async function main() {
  const provider = new Provider(ZKSYNC_PROVIDER_URL);
  const admin = new Wallet(PRIVATE_KEY, provider);

  const tokenContract = getToken(hre, admin);

  const connectedBridgeAddress = await tokenContract.bridge();
  if (connectedBridgeAddress !== hre.ethers.constants.AddressZero) {
    throw new Error("Token is already connected to the bridge");
  }

  const gasPrice = await provider.getGasPrice();

  await (
    await tokenContract.__TetherZkSync_init_v2(ADDRESSES.L2_BRIDGE_PROXY_ADDR, {
      maxFeePerGas: gasPrice,
      maxPriorityFeePerGas: 0,
      gasLimit: 10_000_000,
      customData: {
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
      },
    })
  ).wait();

  console.log(
    `Connected bridge address that can mint/burn tokens: ${await tokenContract.bridge()}`
  );
}

main().catch((error) => {
  throw error;
});

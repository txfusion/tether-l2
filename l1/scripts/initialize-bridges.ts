import * as path from "path";
import { Wallet, utils } from "ethers";

import { Deployer } from "./deploy";
import {
  REQUIRED_L2_GAS_PRICE_PER_PUBDATA,
  getNumberFromEnv,
  readBytecode,
  web3Provider,
} from "./utils/utils";

const provider = web3Provider();

// Artifacts
const l2ProxyArtifactsPath = path.join(
  path.resolve(__dirname, "../.."),
  // "l2/artifacts-zk/@openzeppelin/contracts/proxy/transparent"
  "l2/artifacts-zk/common/proxy"
);

const l2ArtifactsPath = path.join(
  path.resolve(__dirname, "../.."),
  "l2/artifacts-zk/l2/contracts"
);

// Bytecode
const L2_BRIDGE_PROXY_BYTECODE = readBytecode(
  l2ProxyArtifactsPath,
  // "TransparentUpgradeableProxy"
  "OssifiableProxy"
);

const L2_BRIDGE_IMPLEMENTATION_BYTECODE = readBytecode(
  l2ArtifactsPath,
  "L2ERC20Bridge"
);

// Vars
const DEPLOY_L2_BRIDGE_COUNTERPART_GAS_LIMIT = getNumberFromEnv(
  "CONTRACTS_DEPLOY_L2_BRIDGE_COUNTERPART_GAS_LIMIT"
);

async function main() {
  const PRIVATE_KEY = process.env.PRIVATE_KEY as string;
  const CONTRACTS_L1_TOKEN_ADDR = process.env.CONTRACTS_L1_TOKEN_ADDR as string;

  const deployWallet = new Wallet(PRIVATE_KEY, provider);
  const gasPrice = await provider.getGasPrice();

  console.log(`Using deployer wallet: ${deployWallet.address}`);
  console.log(`Using gas price: ${utils.formatUnits(gasPrice, "gwei")} gwei`);

  const deployer = new Deployer({
    deployWallet,
    governorAddress: deployWallet.address,
    verbose: true,
  });

  const l1Bridge = deployer.defaultL1Bridge(deployWallet);
  const zkSync = deployer.zkSyncContract(deployWallet);

  console.log("USDT L1 token:", CONTRACTS_L1_TOKEN_ADDR);
  console.log("USDT L2 token:", deployer.addresses.l2Token);

  const requiredValueToInitializeBridge = await zkSync.l2TransactionBaseCost(
    gasPrice,
    DEPLOY_L2_BRIDGE_COUNTERPART_GAS_LIMIT,
    REQUIRED_L2_GAS_PRICE_PER_PUBDATA
  );

  try {
    console.log("Initializing bridges");

    const tx = await l1Bridge.initialize(
      deployWallet.address,
      deployer.addresses.l1Token,
      {
        gasPrice,
        gasLimit: 10000000,
      }
    );

    const receipt = await tx.wait();
    // TODO: get CONTRACTS_L2_BRIDGE_PROXY_ADDR from registering a new chain on the bridge hub
    // console.log(`CONTRACTS_L2_BRIDGE_PROXY_ADDR=${await l1Bridge.l2Bridge()}`);
    console.log(`Gas used: `, receipt.gasUsed.toString());
  } catch (err) {
    console.log("Error", err);
  }
}

main().catch((err) => {
  throw err;
});

import { Wallet, Provider, Contract } from "zksync-ethers";
import * as ethers from "ethers";
import * as path from "path";
import {
  getAddressFromEnv,
  ethereumProvider,
  zkSyncClientURL,
  readInterface,
} from "../utils/utils";
import { L2_ERC20_BRIDGED_CONSTANTS } from "../../../l2/scripts/utils/constants";

const l1ArtifactsPath = path.join(
  path.resolve(__dirname, "../.."),
  "artifacts/l1/contracts"
);

const l2ArtifactsPath = path.join(
  path.resolve(__dirname, "../../..", "l2"),
  "artifacts-zk/l2/contracts"
);

const L1_BRIDGE_PROXY_ADDR = getAddressFromEnv(
  "CONTRACTS_L1_SHARED_BRIDGE_PROXY_ADDR"
);
const L1_BRIDGE_PROXY_INTERFACE = readInterface(
  l1ArtifactsPath,
  "L1ERC20Bridge"
);
const L1_TOKEN_ADDR = getAddressFromEnv("CONTRACTS_L1_TOKEN_ADDR");
const L1_TOKEN_INTERFACE = readInterface(
  path.join(l1ArtifactsPath, "token"),
  "ERC20Token"
);

const L2_BRIDGE_PROXY_ADDR = getAddressFromEnv(
  "CONTRACTS_L2_BRIDGE_PROXY_ADDR"
);
const L2_BRIDGE_PROXY_INTERFACE = readInterface(
  l2ArtifactsPath,
  "L2ERC20Bridge"
);
const L2_TOKEN_ADDR = getAddressFromEnv("CONTRACTS_L2_TOKEN_PROXY_ADDR");
const L2_TOKEN_INTERFACE = readInterface(
  path.join(l2ArtifactsPath, "token"),
  L2_ERC20_BRIDGED_CONSTANTS.CONTRACT_NAME
);

const AMOUNT_TO_WITHDRAW = ethers.utils.parseEther("0.000005");

const provider = ethereumProvider();
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const zkProvider = new Provider(zkSyncClientURL());
const zkWallet = new Wallet(PRIVATE_KEY, zkProvider, provider);

async function main() {
  console.log("Running script to withdraw ERC20 from zkSync");

  const l1TokenContract = new ethers.Contract(
    L1_TOKEN_ADDR,
    L1_TOKEN_INTERFACE,
    wallet
  );
  const l1BridgeContract = new ethers.Contract(
    L1_BRIDGE_PROXY_ADDR,
    L1_BRIDGE_PROXY_INTERFACE,
    wallet
  );
  const l2TokenContract = new Contract(
    L2_TOKEN_ADDR,
    L2_TOKEN_INTERFACE,
    zkWallet
  );
  const l2BridgeContract = new Contract(
    L2_BRIDGE_PROXY_ADDR,
    L2_BRIDGE_PROXY_INTERFACE,
    zkWallet
  );

  console.log("\n================== BEFORE WITHDRAW =================");
  console.log(
    `Account token balance on L1: ${await l1TokenContract.balanceOf(
      wallet.address
    )}`
  );
  console.log(
    `Bridge token balance on L1 (locked): ${await l1TokenContract.balanceOf(
      l1BridgeContract.address
    )}`
  );
  console.log(
    `Account token balance on L2: ${await l2TokenContract.balanceOf(
      wallet.address
    )}`
  );

  // Withdrawal on L2
  const withdrawResponse = await l2BridgeContract.withdraw(
    wallet.address,
    l2TokenContract.address,
    AMOUNT_TO_WITHDRAW,
    { gasLimit: 10_000_000 }
  );

  await withdrawResponse.waitFinalize();

  // Finalize Withdrawal on L1
  const finalizeWithdrawResponse = await zkWallet.finalizeWithdrawal(
    withdrawResponse.hash
  );
  await finalizeWithdrawResponse.wait();

  console.log("\n================== AFTER FINALIZE WITHDRAW =================");
  console.log(
    `Account token balance on L1: ${await l1TokenContract.balanceOf(
      wallet.address
    )}`
  );
  console.log(
    `Bridge token balance on L1 (locked): ${await l1TokenContract.balanceOf(
      l1BridgeContract.address
    )}`
  );
  console.log(
    `Account token balance on L2: ${await l2TokenContract.balanceOf(
      wallet.address
    )}`
  );
}

main().catch((err) => {
  throw err;
});

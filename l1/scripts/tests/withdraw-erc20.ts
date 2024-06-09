import { Wallet, Provider, Contract } from "zksync-ethers";
import * as ethers from "ethers";
import * as path from "path";
import {
  PRIVATE_KEY,
  defaultL1Bridge,
  defaultL2Bridge,
  ethereumProvider,
  tetherTokenL1,
  tetherTokenL2,
  zkSyncClientURL,
} from "../../../common-utils";

const l1ArtifactsPath = path.join(
  path.resolve(__dirname, "../.."),
  "artifacts/l1/contracts"
);

const l2ArtifactsPath = path.join(
  path.resolve(__dirname, "../../..", "l2"),
  "artifacts-zk/l2/contracts"
);

const AMOUNT_TO_WITHDRAW = ethers.utils.parseEther("0.000005");

const provider = ethereumProvider();
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const zkProvider = new Provider(zkSyncClientURL());
const zkWallet = new Wallet(PRIVATE_KEY, zkProvider, provider);

async function main() {
  console.log("Running script to withdraw ERC20 from zkSync");

  const l1SharedBridge = defaultL1Bridge(zkWallet);
  const l2SharedBridge = defaultL2Bridge(zkWallet);
  const l1Token = tetherTokenL1(zkWallet);
  const l2Token = tetherTokenL2(zkWallet);

  console.log("\n================== BEFORE WITHDRAW =================");
  console.log(
    `Account token balance on L1: ${await l1Token.balanceOf(wallet.address)}`
  );
  console.log(
    `Bridge token balance on L1 (locked): ${await l1Token.balanceOf(
      l1SharedBridge.address
    )}`
  );
  console.log(
    `Account token balance on L2: ${await l2Token.balanceOf(wallet.address)}`
  );

  // Withdrawal on L2
  const withdrawResponse = await l2SharedBridge.withdraw(
    wallet.address,
    l2Token.address,
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
    `Account token balance on L1: ${await l1Token.balanceOf(wallet.address)}`
  );
  console.log(
    `Bridge token balance on L1 (locked): ${await l1Token.balanceOf(
      l1SharedBridge.address
    )}`
  );
  console.log(
    `Account token balance on L2: ${await l2Token.balanceOf(wallet.address)}`
  );
}

main().catch((err) => {
  throw err;
});

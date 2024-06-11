import { Wallet as ZkWallet } from "zksync-ethers";
import { ethers, utils } from "ethers";
import {
  CHAIN_ID,
  PRIVATE_KEY,
  ethereumProvider,
  tetherTokenL1,
  tetherTokenL2,
  zkSyncProvider,
  TETHER_CONSTANTS,
  deployedAddressesFromEnv,
} from "../../../common-utils";

const AMOUNT_TO_WITHDRAW = utils.parseEther("0.001").toString();
const ADDRESSES = deployedAddressesFromEnv();

const provider = ethereumProvider();
const zkProvider = zkSyncProvider();

// const wallet = new Wallet(PRIVATE_KEY, provider);
const wallet = new ZkWallet(PRIVATE_KEY, zkProvider, provider);

async function main() {
  console.log(
    `========== Withdrawing ${AMOUNT_TO_WITHDRAW} ${TETHER_CONSTANTS.SYMBOL} from a hyperchain with chain id = ${CHAIN_ID} ==========`
  );

  const l1Token = tetherTokenL1(wallet._signerL1());
  const l2Token = tetherTokenL2(wallet._signerL2());

  console.log("~~~ Pre-withdraw checks ~~~");
  console.log(
    `Account token balance on L1: ${await l1Token.balanceOf(wallet.address)}`
  );
  console.log(
    `Bridge token balance on L1 (locked): ${await l1Token.balanceOf(
      ADDRESSES.Bridges.L1SharedBridgeProxy
    )}`
  );
  console.log(
    `Account token balance on L2: ${await l2Token.balanceOf(wallet.address)}`
  );
  console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

  console.log("~~~ Withdrawing... ~~~");
  const withdrawTx = await wallet.withdraw({
    token: l2Token.address,
    amount: AMOUNT_TO_WITHDRAW,
    bridgeAddress: ADDRESSES.Bridges.L2SharedBridgeProxy,
  });
  await withdrawTx.waitFinalize();

  await (await wallet.finalizeWithdrawal(withdrawTx.hash)).wait();

  console.log("\n~~~ Post-withdraw checks ~~~");
  console.log(
    `Is withdrawal finalized?`,
    await wallet.isWithdrawalFinalized(withdrawTx.hash)
  );
  console.log(
    `Account token balance on L1: ${await l1Token.balanceOf(wallet.address)}`
  );
  console.log(
    `Bridge token balance on L1: ${await l1Token.balanceOf(
      ADDRESSES.Bridges.L1SharedBridgeProxy
    )}`
  );
  console.log(
    `Account token balance on L2: ${await l2Token.balanceOf(wallet.address)}`
  );
  console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");
}

main().catch((err) => {
  throw err;
});

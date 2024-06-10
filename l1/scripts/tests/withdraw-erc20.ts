import { Wallet as ZkWallet } from "zksync-ethers";
import { Wallet, utils } from "ethers";
import {
  CHAIN_ID,
  PRIVATE_KEY,
  defaultL1Bridge,
  ethereumProvider,
  tetherTokenL1,
  tetherTokenL2,
  zkSyncProvider,
  SYSTEM_CONFIG_CONSTANTS,
  TETHER_CONSTANTS,
  deployedAddressesFromEnv,
} from "../../../common-utils";

const AMOUNT_TO_DEPOSIT = utils.parseEther("0.001").toString();
const ADDRESSES = deployedAddressesFromEnv();

const provider = ethereumProvider();
const zkProvider = zkSyncProvider();

// const wallet = new Wallet(PRIVATE_KEY, provider);
const wallet = new ZkWallet(PRIVATE_KEY, zkProvider, provider);

async function main() {
  console.log(
    `========== Withdrawing ${AMOUNT_TO_DEPOSIT} ${TETHER_CONSTANTS.SYMBOL} from a hyperchain with chain id = ${CHAIN_ID} ==========`
  );

  const l1Token = tetherTokenL1(wallet);
  const l2Token = tetherTokenL2(wallet);

  console.log("~~~ Pre-withdraw checks ~~~");
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

  console.log("~~~ Withdrawing... ~~~");
  const withdrawTx = await wallet.withdraw({
    token: l2Token.address,
    amount: AMOUNT_TO_DEPOSIT,
    bridgeAddress: ADDRESSES.Bridges.L2SharedBridgeProxy,
  });

  const withdrawReceipt = await withdrawTx.waitFinalize();

  await (await wallet.finalizeWithdrawal(withdrawReceipt.hash)).wait(1);

  console.log("\n~~~ Post-withdraw checks ~~~");
  console.log(
    `Is withdrawal finalized?`,
    await wallet.isWithdrawalFinalized(withdrawReceipt.hash)
  );
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
}

main().catch((err) => {
  throw err;
});

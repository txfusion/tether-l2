import { Wallet as ZkWallet } from "zksync-ethers";
import { ethers } from "ethers";
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

const AMOUNT_TO_DEPOSIT = ethers.utils.parseEther("0.001").toString();
const ADDRESSES = deployedAddressesFromEnv();

const provider = ethereumProvider();
const zkProvider = zkSyncProvider();

// const wallet = new Wallet(PRIVATE_KEY, provider);
const wallet = new ZkWallet(PRIVATE_KEY, zkProvider, provider);

async function main() {
  console.log(
    `========== Depositing ${AMOUNT_TO_DEPOSIT} ${TETHER_CONSTANTS.SYMBOL} to a hyperchain with chain id = ${CHAIN_ID} ==========`
  );

  const l1Token = tetherTokenL1(wallet._signerL1());
  const l2Token = tetherTokenL2(wallet._signerL2());

  console.log(
    `>>> 1) Minting ${AMOUNT_TO_DEPOSIT} L1 tokens to ${wallet.address}`
  );
  await (
    await l1Token.mint(wallet.address, AMOUNT_TO_DEPOSIT, {
      gasLimit: 10_000_000,
    })
  ).wait(1);
  console.log(
    `Account token balance after minting: ${await l1Token.balanceOf(
      wallet.address
    )}\n`
  );

  console.log(
    `>>> Note: Approval of ${AMOUNT_TO_DEPOSIT} tokens to the bridge is done within the 'deposit' call of the SDK`
  );
  // console.log(
  //   `>>> 2) Approving ${AMOUNT_TO_DEPOSIT} tokens to the bridge (done within the deposit call of the SDK)`
  // );
  // await (
  //   await l1Token
  //     .connect(wallet)
  //     .approve(ADDRESSES.Bridges.L1SharedBridgeProxy, AMOUNT_TO_DEPOSIT, {
  //       gasLimit: 10_000_000,
  //     })
  // ).wait(1);

  // console.log(
  //   `L1 Bridge allowance: ${await l1Token.allowance(
  //     wallet.address,
  //     ADDRESSES.Bridges.L1SharedBridgeProxy
  //   )}`
  // );
  console.log("----- Setup complete, moving on ------\n");

  console.log("~~~ Pre-deposit checks ~~~");
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

  console.log("~~~ Depositing... ~~~");

  const depositTx = await wallet.deposit({
    token: l1Token.address,
    amount: AMOUNT_TO_DEPOSIT,
    bridgeAddress: ADDRESSES.Bridges.L1SharedBridgeProxy,
    approveERC20: true,
  });
  await depositTx.waitFinalize();

  console.log("\n~~~ Post-deposit checks ~~~");
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

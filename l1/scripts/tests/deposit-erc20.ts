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

const AMOUNT_TO_DEPOSIT = utils.parseEther("0.001").toString();
const ADDRESSES = deployedAddressesFromEnv();

const provider = ethereumProvider();
const zkProvider = zkSyncProvider();

// const wallet = new Wallet(PRIVATE_KEY, provider);
const wallet = new ZkWallet(PRIVATE_KEY, zkProvider, provider);

async function main() {
  console.log(
    `========== Depositing ${AMOUNT_TO_DEPOSIT} ${TETHER_CONSTANTS.SYMBOL} to a hyperchain with chain id = ${CHAIN_ID} ==========`
  );

  const l1Token = tetherTokenL1(wallet);
  const l2Token = tetherTokenL2(wallet);

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

  console.log(`>>> 2) Approving ${AMOUNT_TO_DEPOSIT} tokens to the bridge`);
  await (
    await l1Token
      .connect(wallet)
      .approve(ADDRESSES.Bridges.L1SharedBridgeProxy, AMOUNT_TO_DEPOSIT, {
        gasLimit: 10_000_000,
      })
  ).wait(1);

  console.log(
    `L1 Bridge allowance: ${await l1Token.allowance(
      wallet.address,
      ADDRESSES.Bridges.L1SharedBridgeProxy
    )}`
  );
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

  const coder = new ethers.utils.AbiCoder();

  const depositTx = await wallet.deposit({
    token: l1Token.address,
    amount: AMOUNT_TO_DEPOSIT,
    bridgeAddress: ADDRESSES.Bridges.L1SharedBridgeProxy,
    customBridgeData: coder.encode(
      ["bytes", "bytes", "bytes"],
      [
        coder.encode(["string"], [TETHER_CONSTANTS.NAME]),
        coder.encode(["string"], [TETHER_CONSTANTS.SYMBOL]),
        coder.encode(["uint256"], [TETHER_CONSTANTS.DECIMALS]), // TODO: Either 6 decimals for the real L2 token or 18 decimals for mock L1 token
      ]
    ),
  });
  await depositTx.waitFinalize();

  // await (await zkProvider.getL2TransactionFromPriorityOp(depositTx)).wait();

  // TODO: Finalize deposit

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

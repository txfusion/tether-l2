import { Wallet, Provider, utils } from "zksync-ethers";
import * as ethers from "ethers";
import {
  CHAIN_ID,
  PRIVATE_KEY,
  defaultL1Bridge,
  ethereumProvider,
  tetherTokenL1,
  tetherTokenL2,
  zkSyncClientURL,
} from "../../../common-utils";
import { Deployer } from "../utils/deployer";

const AMOUNT_TO_DEPOSIT = ethers.utils.parseEther("0.001");

const provider = ethereumProvider();
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const zkProvider = new Provider(zkSyncClientURL());
const zkWallet = new Wallet(PRIVATE_KEY, zkProvider, provider);

async function main() {
  console.log(
    `>>> Depositing USDT to a hyperchain with chain id = ${CHAIN_ID}`
  );

  const deployWallet = new Wallet(PRIVATE_KEY, provider);

  const deployer = new Deployer({
    deployWallet,
    verbose: true,
  });

  const l1SharedBridge = defaultL1Bridge(deployWallet);
  const l1Token = tetherTokenL1(deployWallet);
  const l2Token = tetherTokenL2(deployWallet);

  // Mint tokens to L1 account
  const mintResponse = await l1Token.mint(wallet.address, AMOUNT_TO_DEPOSIT, {
    gasLimit: 10_000_000,
  });

  await mintResponse.wait();

  // Set allowance to L1 bridge
  const allowanceResponse = await l1Token.approve(
    l1SharedBridge.address,
    AMOUNT_TO_DEPOSIT,
    { gasLimit: 10_000_000 }
  );
  await allowanceResponse.wait();
  console.log(
    `L1 Bridge allowance: ${await l1Token.allowance(
      wallet.address,
      l1SharedBridge.address
    )}`
  );

  console.log("\n================== BEFORE DEPOSIT =================");
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

  const depositTx = await l1SharedBridge.populateTransaction[
    "deposit(address,address,uint256,uint256,uint256,address)"
  ](
    wallet.address,
    l1Token.address,
    AMOUNT_TO_DEPOSIT,
    ethers.BigNumber.from(10_000_000),
    utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
    wallet.address,
    { gasLimit: 10_000_000 }
  );

  // call to RPC method zks_estimateGasL1ToL2 to estimate L2 gas limit
  const l2GasLimit = await zkProvider.estimateGasL1(depositTx);
  const l2GasPrice = await zkProvider.getGasPrice();

  const baseCost = await zkWallet.getBaseCost({
    gasLimit: l2GasLimit,
    gasPrice: l2GasPrice,
    gasPerPubdataByte: utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
  });

  const depositResponse = await l1SharedBridge[
    "deposit(address,address,uint256,uint256,uint256,address)"
  ](
    wallet.address,
    l1Token.address,
    AMOUNT_TO_DEPOSIT,
    l2GasLimit,
    utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
    wallet.address,
    {
      value: baseCost,
      gasLimit: 10_000_000,
    }
  );
  await depositResponse.wait();

  const l2Response = await zkProvider.getL2TransactionFromPriorityOp(
    depositResponse
  );
  await l2Response.wait();

  console.log("\n================== AFTER DEPOSIT =================");
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

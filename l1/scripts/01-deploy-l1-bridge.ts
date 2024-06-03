import "@nomiclabs/hardhat-ethers";
import { Wallet } from "ethers";
import { web3Provider } from "./utils/utils";
import { Deployer } from "./deploy";
import {
  L1SharedBridge__factory,
  ERC20Token__factory,
  TransparentUpgradeableProxy__factory,
  IBridgehub__factory,
} from "../typechain/index";
import { L1_ERC20_BRIDGED_CONSTANTS } from "./utils/constants";

const PRIVATE_KEY = process.env.PRIVATE_KEY as string;
const IS_LOCAL = (process.env.NODE_ENV as string) === "local";
const ZKSYNC_CHAIN_ID = Number(process.env.ZKSYNC_CHAIN_ID);

const provider = web3Provider();

// TODO: Initialize implementations
async function main() {
  const deployWallet = new Wallet(PRIVATE_KEY, provider);
  const adminAddress = deployWallet.address;

  const deployer = new Deployer({
    deployWallet,
    verbose: true,
  });

  let l1ERC20TokenAddress = deployer.addresses.l1Token;
  if (IS_LOCAL) {
    /**
     * 0. Deploy USDT token, if needed (only in local)
     */
    const L1ERC20Token = await new ERC20Token__factory(deployWallet).deploy(
      L1_ERC20_BRIDGED_CONSTANTS.NAME,
      L1_ERC20_BRIDGED_CONSTANTS.SYMBOL,
      L1_ERC20_BRIDGED_CONSTANTS.DECIMALS
    );

    console.log(`CONTRACTS_L1_TOKEN_ADDR=${L1ERC20Token.address}`);
    l1ERC20TokenAddress = L1ERC20Token.address;
  }

  /**
   * 1. Deploy L1SharedBridge Implementation
   */
  const l1SharedBridgeContractImpl = await new L1SharedBridge__factory(
    deployWallet
  ).deploy(
    deployer.addresses.bridging.bridgeHubProxy, // not used: WETH address
    deployer.addresses.bridging.bridgeHubProxy,
    ZKSYNC_CHAIN_ID,
    deployer.addresses.zkSync.diamondProxy
  );

  console.log(
    `CONTRACTS_L1_SHARED_BRIDGE_IMPLEMENTATION_ADDR=${l1SharedBridgeContractImpl.address}`
  );

  deployer.verifyContract(l1SharedBridgeContractImpl.address);

  /**
   * 2. Deploy L1SharedBridge Proxy
   */
  const l1BridgeContractProxy = await new TransparentUpgradeableProxy__factory(
    deployWallet
  ).deploy(l1SharedBridgeContractImpl.address, adminAddress, "0x", {
    gasLimit: 10_000_000,
  });

  console.log(
    `CONTRACTS_L1_SHARED_BRIDGE_PROXY_ADDR=${l1BridgeContractProxy.address}`
  );

  /**
   * 3. Register stuff on bridgehub
   */
  const bridgehub = IBridgehub__factory.connect(
    deployer.addresses.bridging.bridgeHubProxy,
    deployWallet
  );

  // 3.1 registering USDT as a valid token
  const tx2 = await bridgehub.addToken(l1ERC20TokenAddress);
  await tx2.wait();

  // 3.2 Note: We don't have to register custom shared bridge to bridgehub, because it won't be used as the default one for base tokens
  // const tx3 = await bridgehub.setSharedBridge(
  //   deployer.addresses.bridging.l1BridgeProxy,
  // );
  // const receipt3 = await tx3.wait();

  /**
   * 4. Verify contracts
   */
  deployer.verifyContract(l1BridgeContractProxy.address, [
    l1SharedBridgeContractImpl.address,
    adminAddress,
    "0x",
  ]);

  /**
   * 5. Initialize
   */
  console.log("Initializing shared bridge...");
  const initTx = await deployer
    .defaultL1Bridge(deployWallet)
    .initialize(deployWallet.address, l1ERC20TokenAddress);
  await initTx.wait();
  console.log("Shared bridge initialized!");

  /**
   * 6. Set parameters (do we need it)
   */
  // Note: perhaps unnecessary
  // const data1 = l1BridgeContractProxy.interface.encodeFunctionData(
  //   "setL1Erc20Bridge",
  //   [this.addresses.Bridges.ERC20BridgeProxy]
  // );
  // const data2 = l1SharedBridgeContractImpl.interface.encodeFunctionData(
  //   "setEraPostDiamondUpgradeFirstBatch",
  //   [process.env.CONTRACTS_ERA_POST_DIAMOND_UPGRADE_FIRST_BATCH ?? 1]
  // );
  // const data3 = l1SharedBridgeContractImpl.interface.encodeFunctionData(
  //   "setEraPostLegacyBridgeUpgradeFirstBatch",
  //   [process.env.CONTRACTS_ERA_POST_LEGACY_BRIDGE_UPGRADE_FIRST_BATCH ?? 1]
  // );
  // const data4 = l1SharedBridgeContractImpl.interface.encodeFunctionData(
  //   "setEraLegacyBridgeLastDepositTime",
  //   [
  //     process.env.CONTRACTS_ERA_LEGACY_UPGRADE_LAST_DEPOSIT_BATCH ?? 1,
  //     process.env.CONTRACTS_ERA_LEGACY_UPGRADE_LAST_DEPOSIT_TX_NUMBER ?? 0,
  //   ]
  // );
  // await executeUpgrade(deployer.addresses.bridging.l1BridgeProxy, 0, data1);
  // await executeUpgrade(deployer.addresses.bridging.l1BridgeProxy, 0, data2);
  // await executeUpgrade(deployer.addresses.bridging.l1BridgeProxy, 0, data3);
  // await executeUpgrade(deployer.addresses.bridging.l1BridgeProxy, 0, data4);
}

// async function executeUpgrade(
//   deployer: Deployer,
//   targetAddress: string,
//   value: BigNumberish,
//   callData: string,
//   printOperation: boolean = false
// ) {
//   const governance = IGovernance__factory.connect(
//     deployer.addresses.governance,
//     deployer.wallet
//   );
//   const operation = {
//     calls: [{ target: targetAddress, value: value, data: callData }],
//     predecessor: ethers.constants.HashZero,
//     salt: ethers.utils.hexlify(ethers.utils.randomBytes(32)),
//   };

//   console.log("Operation:", operation);
//   console.log(
//     "Schedule operation: ",
//     governance.interface.encodeFunctionData("scheduleTransparent", [
//       operation,
//       0,
//     ])
//   );
//   console.log(
//     `Execute operation value: ${value}, calldata`,
//     governance.interface.encodeFunctionData("execute", [operation])
//   );

//   const scheduleTx = await governance.scheduleTransparent(operation, 0);
//   await scheduleTx.wait();

//   const executeTX = await governance.execute(operation, { value: value });
//   const receipt = await executeTX.wait();

//   console.log(
//     "Upgrade with target ",
//     targetAddress,
//     "executed: ",
//     await governance.isOperationDone(await governance.hashOperation(operation))
//   );
// }

main().catch((error) => {
  throw error;
});

import * as hre from "hardhat";
import { BigNumberish, Contract } from "ethers";
import { utils } from "zksync-web3";

import { setup } from "./bridge.setup";
import { L1ERC20Bridge__factory } from "../../typechain";
import { L2ERC20Bridge__factory } from "../../../l2/typechain";

export const ZKSYNC_ADDRESSES = {
  l1: {
    l1Token: process.env.CONTRACTS_L1_TOKEN_ADDR as string,
    l1Bridge: process.env.CONTRACTS_L1_BRIDGE_PROXY_ADDR as string,
  },
  l2: {
    l2Token: process.env.CONTRACTS_L2_TOKEN_PROXY_ADDR as string, // connection tests to l1 succeed, erc20 tests fails
    l2Bridge: process.env.CONTRACTS_L2_BRIDGE_PROXY_ADDR as string,
  },
};

export const BRIDGE_ACTIONS = {
  disableDeposits: "disableDeposits",
  enableDeposits: "enableDeposits",
  enableWithdrawals: "enableWithdrawals",
  disableWithdrawals: "disableWithdrawals",
} as const;

/**
 * executeGovOnL1Bridge
 * @param bridge
 * @param agent
 * @param type
 */
export async function executeGovOnL1Bridge(
  bridge: Contract,
  agent: Contract,
  type: (typeof BRIDGE_ACTIONS)[keyof typeof BRIDGE_ACTIONS]
) {
  const IL1Bridge = L1ERC20Bridge__factory.createInterface();

  const data = IL1Bridge.encodeFunctionData(BRIDGE_ACTIONS[type] as string, []);
  const txResponse = await agent.execute(bridge.address, 0, data, {
    gasLimit: 10_000_000,
  });

  await txResponse.wait();
}

/**
 * executeGovOnL2Bridge
 * @param bridge
 * @param agent
 * @param type
 * @param ctx
 */
export async function executeGovOnL2Bridge(
  bridge: Contract,
  agent: Contract,
  type: (typeof BRIDGE_ACTIONS)[keyof typeof BRIDGE_ACTIONS],
  ctx: Awaited<ReturnType<typeof setup>>
) {
  const { l1, l2, zkProvider, ethProvider } = ctx;

  const wallet = l1.accounts.deployer;
  const gasPrice = await ethProvider.getGasPrice();

  const ZkSyncBridgeExecutor = new ZkSyncBridgeExecutor__factory(
    l2.accounts.deployer
  ).attach(l2.govExecutor.address);

  const IZkSyncBridgeExecutorUpgradable = ZkSyncBridgeExecutor.interface;

  // encode data to be queued by ZkBridgeExecutor on L2
  const data = IZkSyncBridgeExecutorUpgradable.encodeFunctionData("queue", [
    [bridge.address],
    [hre.ethers.utils.parseEther("0")],
    [`${BRIDGE_ACTIONS[type]}()`],
    [new Uint8Array()],
  ]);

  // estimate gas to to bridge encoded from L1 to L2
  const gasLimit = await zkProvider.estimateL1ToL2Execute({
    contractAddress: l2.govExecutor.address,
    calldata: data,
    caller: utils.applyL1ToL2Alias(l1.l1Executor.address),
  });
  // estimate cons of L1 to L2 execution
  const baseCost = await l1.zkSync.l2TransactionBaseCost(
    gasPrice,
    gasLimit,
    utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT
  );

  // if call exception change value
  const ethTransferResponse = await wallet.sendTransaction({
    to: l1.agent.address,
    value: baseCost,
  });
  await ethTransferResponse.wait();

  /**
   * Encode data which is sent to L1 Executor
   * * This data contains previously encoded queue data
   */
  const encodedDataQueue =
    L1Executor__factory.createInterface().encodeFunctionData("callZkSync", [
      l2.govExecutor.address,
      data,
      gasLimit,
      utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
    ]);

  /**
   *  Sends Action set from L1 Executor to L2 Bridge Executor
   */
  const executeTx = await agent.execute(
    l1.l1Executor.address,
    baseCost,
    encodedDataQueue,
    { gasPrice, gasLimit: 10_000_000 }
  );

  const actionSetQueuedPromise = new Promise((resolve) => {
    ZkSyncBridgeExecutor.on("ActionsSetQueued", (actionSetId: any) => {
      resolve(actionSetId.toString());
      ZkSyncBridgeExecutor.removeAllListeners();
    });
  });

  await executeTx.wait();

  const actionSetId = await actionSetQueuedPromise.then((res) => res);
  const l2Response2 = await zkProvider.getL2TransactionFromPriorityOp(
    executeTx
  );
  await l2Response2.wait();

  /**
   * Execute Action Set
   */
  const executeAction = await ZkSyncBridgeExecutor.execute(
    actionSetId as BigNumberish,
    {
      gasLimit: 10_000_000,
    }
  );

  await executeAction.wait();
}

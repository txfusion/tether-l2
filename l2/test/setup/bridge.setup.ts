import hre from "hardhat";
import { Wallet } from "zksync-ethers";
import { ethers } from "ethers";

import { Deployer as ZkDeployer } from "@matterlabs/hardhat-zksync-deploy";

import { richWallets } from "../../../common-utils/rich_wallets";

import {
  CHAIN_ID,
  TETHER_CONSTANTS,
  defaultL2Bridge,
  ethereumProvider,
  zkSyncProvider,
} from "../../../common-utils";

export async function setup() {
  const zkProvider = zkSyncProvider();
  const ethProvider = ethereumProvider();

  const deployerWallet = new Wallet(
    richWallets[0].privateKey,
    zkProvider,
    ethProvider
  );
  const l1Bridge = new Wallet(
    richWallets[1].privateKey,
    zkProvider,
    ethProvider
  );
  const l1BridgeWrong = new Wallet(
    richWallets[2].privateKey,
    zkProvider,
    ethProvider
  );
  const sender = new Wallet(richWallets[3].privateKey, zkProvider, ethProvider);
  const recipient = new Wallet(
    richWallets[4].privateKey,
    zkProvider,
    ethProvider
  );
  const stranger = new Wallet(
    richWallets[5].privateKey,
    zkProvider,
    ethProvider
  );

  const zkDeployer = new ZkDeployer(hre, deployerWallet);

  // ********** Stubs **********
  // - L2 Token
  const l2Token = await (
    await zkDeployer.deploy(await zkDeployer.loadArtifact("ERC20BridgedStub"), [
      TETHER_CONSTANTS.NAME,
      TETHER_CONSTANTS.SYMBOL,
    ])
  ).deployed();

  // - L1 Token
  const l1Token = await (
    await zkDeployer.deploy(await zkDeployer.loadArtifact("EmptyContractStub"))
  ).deployed();

  // L2 Bridge
  const l2SharedBridgeImpl = await (
    await zkDeployer.deploy(await zkDeployer.loadArtifact("L2SharedBridge"), [
      CHAIN_ID,
    ])
  ).deployed();

  const l2SharedBridgeProxy = await (
    await zkDeployer.deploy(
      await zkDeployer.loadArtifact("TransparentUpgradeableProxy"),
      [
        l2SharedBridgeImpl.address,
        l1Bridge.address, // note: won't be used
        new ethers.utils.Interface(
          hre.artifacts.readArtifactSync("L2SharedBridge").abi
        ).encodeFunctionData("initialize", [
          l1Bridge.address,
          l1Token.address,
          l2Token.address,
          zkDeployer.zkWallet.address,
        ]),
      ]
    )
  ).deployed();

  await (await l2Token.setBridge(l2SharedBridgeProxy.address)).wait();

  return {
    accounts: {
      deployerWallet,
      recipient,
      sender,
      stranger,
    },
    stubs: {
      l1Token: l1Token,
      l2Token: l2Token,
    },
    l2SharedBridge: defaultL2Bridge(
      zkDeployer.zkWallet,
      l2SharedBridgeProxy.address
    ),
    l1SharedBridge: l1Bridge,
    l1SharedBridgeWrong: l1BridgeWrong,
    gasLimit: 10_000_000,
    AMOUNT: ethers.utils.parseEther("1"),
  };
}

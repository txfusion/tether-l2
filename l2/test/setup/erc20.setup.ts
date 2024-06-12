import hre from "hardhat";
import { Wallet } from "zksync-ethers";
import { BigNumber, utils } from "ethers";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

import { TetherZkSync } from "../../typechain";
import {
  CHAIN_ID,
  TETHER_CONSTANTS,
  ethereumProvider,
  richWallets,
  zkSyncProvider,
} from "../../../common-utils";

const INITIAL_BALANCE = utils.parseEther("10");

export async function setup() {
  const zkProvider = zkSyncProvider();
  const ethProvider = ethereumProvider();

  const deployerWallet = new Wallet(
    richWallets[0].privateKey,
    zkProvider,
    ethProvider
  );
  const bridge = new Wallet(richWallets[1].privateKey, zkProvider, ethProvider);
  const initialHolder = new Wallet(
    richWallets[2].privateKey,
    zkProvider,
    ethProvider
  );
  const spender = new Wallet(
    richWallets[3].privateKey,
    zkProvider,
    ethProvider
  );
  const erc1271WalletOwner = new Wallet(
    richWallets[4].privateKey,
    zkProvider,
    ethProvider
  );

  const deployer = new Deployer(hre, deployerWallet);

  // L2 token
  const erc20BridgedArtifact = await deployer.loadArtifact("TetherZkSync");

  const erc20Bridged = (await hre.zkUpgrades.deployProxy(
    deployer.zkWallet,
    erc20BridgedArtifact,
    [TETHER_CONSTANTS.NAME, TETHER_CONSTANTS.SYMBOL, TETHER_CONSTANTS.DECIMALS],
    { initializer: "__TetherZkSync_init" },
    true
  )) as TetherZkSync;

  await erc20Bridged
    .connect(deployer.zkWallet)
    .__TetherZkSync_init_v2(bridge.address);

  await erc20Bridged.transferOwnership(bridge.address);

  const erc1271WalletContract = await deployer.deploy(
    await deployer.loadArtifact("ERC1271WalletStub"),
    [erc1271WalletOwner.address]
  );
  await erc1271WalletContract.deployed();

  // mint initial balance to initialHolder wallet
  await (
    await erc20Bridged
      .connect(bridge)
      .bridgeMint(initialHolder.address, INITIAL_BALANCE)
  ).wait();

  // mint initial balance to smart contract wallet
  await (
    await erc20Bridged
      .connect(bridge)
      .bridgeMint(erc1271WalletContract.address, INITIAL_BALANCE)
  ).wait();

  return {
    accounts: {
      deployerWallet,
      bridge,
      initialHolder,
      spender,
      erc1271WalletOwner,
    },
    erc20Bridged: erc20Bridged.connect(bridge),
    erc1271Wallet: erc1271WalletContract,
    domain: {
      name: TETHER_CONSTANTS.NAME,
      version: TETHER_CONSTANTS.VERSION,
      chainId: CHAIN_ID,
      verifyingContract: erc20Bridged.address,
    },
    gasLimit: 10_000_000,
    roles: {
      BRIDGE_ROLE: utils.hexlify(
        BigNumber.from(await erc20Bridged.BRIDGE_ROLE())
      ),
    },
    DEFAULT_AMOUNT: INITIAL_BALANCE.div(10),
    ethProvider,
    zkProvider,
  };
}

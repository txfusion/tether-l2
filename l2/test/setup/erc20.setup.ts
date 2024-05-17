import hre from "hardhat";
import { Wallet, Provider, Contract } from "zksync-ethers";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { BigNumber, ethers } from "ethers";

import { richWallet } from "../../../l1/scripts/utils/rich_wallet";
import {
  PROVIDER_URL,
  CHAIN_ID,
  L2_TOKEN_NAME,
  L2_TOKEN_SYMBOL,
  L2_TOKEN_DECIMALS,
  L2_TOKEN_SINGING_DOMAIN_VERSION,
} from "../utils/constants";
import { TetherZkSync } from "../../typechain";

const INITIAL_BALANCE = ethers.utils.parseEther("10");

export async function setup() {
  const provider = new Provider(PROVIDER_URL);

  const deployerWallet = new Wallet(richWallet[0].privateKey, provider);
  const admin = new Wallet(richWallet[1].privateKey, provider);
  const initialHolder = new Wallet(richWallet[2].privateKey, provider);
  const spender = new Wallet(richWallet[3].privateKey, provider);
  const erc1271WalletOwner = new Wallet(richWallet[4].privateKey, provider);

  const deployer = new Deployer(hre, deployerWallet);

  // L2 token
  const erc20BridgedArtifact = await deployer.loadArtifact("TetherZkSync");

  const erc20Bridged = (await hre.zkUpgrades.deployProxy(
    deployer.zkWallet,
    erc20BridgedArtifact,
    [L2_TOKEN_NAME, L2_TOKEN_SYMBOL, L2_TOKEN_DECIMALS],
    { initializer: "__TetherZkSync_init" },
    true
  )) as TetherZkSync;

  await erc20Bridged
    .connect(deployer.zkWallet)
    .__TetherZkSync_init_v2(admin.address);

  await erc20Bridged.transferOwnership(admin.address);

  const erc1271WalletArtifact = await deployer.loadArtifact(
    "ERC1271WalletStub"
  );

  const erc1271WalletContract = await deployer.deploy(erc1271WalletArtifact, [
    erc1271WalletOwner.address,
  ]);
  await erc1271WalletContract.deployed();

  // mint initial balance to initialHolder wallet
  await (
    await erc20Bridged
      .connect(admin)
      .bridgeMint(initialHolder.address, INITIAL_BALANCE)
  ).wait();

  // mint initial balance to smart contract wallet
  await (
    await erc20Bridged
      .connect(admin)
      .bridgeMint(erc1271WalletContract.address, INITIAL_BALANCE)
  ).wait();

  const BRIDGE_ROLE = await erc20Bridged.BRIDGE_ROLE();

  return {
    accounts: {
      deployerWallet,
      admin,
      initialHolder,
      spender,
      erc1271WalletOwner,
    },
    erc20Bridged,
    erc1271Wallet: erc1271WalletContract,
    erc20Metadata: {
      name: L2_TOKEN_NAME,
      symbol: L2_TOKEN_SYMBOL,
      decimals: L2_TOKEN_DECIMALS,
    },
    domain: {
      name: L2_TOKEN_NAME,
      version: L2_TOKEN_SINGING_DOMAIN_VERSION,
      chainId: CHAIN_ID,
      verifyingContract: erc20Bridged.address,
    },
    gasLimit: 10_000_000,
    roles: {
      BRIDGE_ROLE: ethers.utils.hexlify(BigNumber.from(BRIDGE_ROLE)),
    },
    DEFAULT_AMOUNT: INITIAL_BALANCE.div(10),
    provider,
  };
}

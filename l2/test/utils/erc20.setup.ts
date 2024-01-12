import hre from "hardhat";
import { Wallet, Provider, Contract } from "zksync-web3";
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

const INITIAL_BALANCE = ethers.utils.parseEther("10");

export async function setup() {
  const provider = new Provider(PROVIDER_URL);

  const deployerWallet = new Wallet(richWallet[0].privateKey, provider);
  const governor = new Wallet(richWallet[1].privateKey, provider);
  const adminAddress = governor.address;
  const initialHolder = new Wallet(richWallet[2].privateKey, provider);
  const spender = new Wallet(richWallet[3].privateKey, provider);
  const erc1271WalletOwner = new Wallet(richWallet[4].privateKey, provider);

  const deployer = new Deployer(hre, deployerWallet);

  const ossifiableProxyArtifact = await deployer.loadArtifact(
    "OssifiableProxy"
  );

  // L2 token
  const erc20BridgedArtifact = await deployer.loadArtifact(
    "ERC20BridgedUpgradeable"
  );
  const erc20BridgedContract = await deployer.deploy(erc20BridgedArtifact, []);
  const erc20BridgedImpl = await erc20BridgedContract.deployed();

  // proxy
  const erc20BridgedProxyContract = await deployer.deploy(
    ossifiableProxyArtifact,
    [erc20BridgedImpl.address, adminAddress, "0x"]
  );
  const erc20BridgedProxy = await erc20BridgedProxyContract.deployed();

  const erc20Bridged = new Contract(
    erc20BridgedProxy.address,
    erc20BridgedArtifact.abi,
    deployer.zkWallet
  );

  const initTx = await erc20Bridged[
    "__ERC20BridgedUpgradeable_init(string,string,uint8,address)"
  ](L2_TOKEN_NAME, L2_TOKEN_SYMBOL, L2_TOKEN_DECIMALS, adminAddress);
  await initTx.wait();

  const initV2Tx = await erc20Bridged[
    "__ERC20BridgedUpgradeable_init_v2(address)"
  ](deployerWallet.address);
  await initV2Tx.wait();

  const erc1271WalletArtifact = await deployer.loadArtifact(
    "ERC1271WalletStub"
  );

  const erc1271WalletContract = await deployer.deploy(erc1271WalletArtifact, [
    erc1271WalletOwner.address,
  ]);
  await erc1271WalletContract.deployed();

  // mint initial balance to initialHolder wallet
  await (
    await erc20Bridged.bridgeMint(initialHolder.address, INITIAL_BALANCE)
  ).wait();

  // mint initial balance to smart contract wallet
  await (
    await erc20Bridged.bridgeMint(
      erc1271WalletContract.address,
      INITIAL_BALANCE
    )
  ).wait();

  const ADDRESS_FREEZER_ROLE = await erc20Bridged.ADDRESS_FREEZER_ROLE();
  const ADDRESS_BURNER_ROLE = await erc20Bridged.ADDRESS_BURNER_ROLE();

  return {
    accounts: {
      deployerWallet,
      governor,
      initialHolder,
      spender,
      erc1271WalletOwner,
    },
    erc20Bridged,
    erc1271Wallet: erc1271WalletContract,
    domain: {
      name: L2_TOKEN_NAME,
      version: L2_TOKEN_SINGING_DOMAIN_VERSION,
      chainId: CHAIN_ID,
      verifyingContract: erc20Bridged.address,
    },
    gasLimit: 10_000_000,
    roles: {
      ADDRESS_FREEZER_ROLE: ethers.utils.hexlify(
        BigNumber.from(ADDRESS_FREEZER_ROLE)
      ),
      ADDRESS_BURNER_ROLE: ethers.utils.hexlify(
        BigNumber.from(ADDRESS_BURNER_ROLE)
      ),
    },
  };
}

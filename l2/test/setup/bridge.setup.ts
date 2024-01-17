import hre from "hardhat";

import { Provider, Wallet, Contract, utils } from "zksync-ethers";
import { richWallet } from "../../../l1/scripts/utils/rich_wallet";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

import { L2_TOKEN_NAME, L2_TOKEN_SYMBOL } from "../utils/constants";
import { ethers } from "ethers";

const TESTNET_PROVIDER_URL = "http://localhost:3050";

export async function setup() {
  const provider = new Provider(TESTNET_PROVIDER_URL);

  const deployerWallet = new Wallet(richWallet[0].privateKey, provider);
  const governor = new Wallet(richWallet[1].privateKey, provider);
  const sender = new Wallet(richWallet[2].privateKey, provider);
  const recipient = new Wallet(richWallet[3].privateKey, provider);
  const stranger = new Wallet(richWallet[4].privateKey, provider);

  const deployer = new Deployer(hre, deployerWallet);

  // L2 Token
  const L2TokenArtifact = await deployer.loadArtifact("ERC20BridgedStub");
  const L2TokenContract = await deployer.deploy(L2TokenArtifact, [
    L2_TOKEN_NAME,
    L2_TOKEN_SYMBOL,
  ]);

  const l2Token = await L2TokenContract.deployed();

  // L1 Token
  const emptyContractStubArtifact = await deployer.loadArtifact(
    "EmptyContractStub"
  );
  const l1TokenImplContract = await deployer.deploy(emptyContractStubArtifact);
  const l1Token = await l1TokenImplContract.deployed();

  const ossifiableProxyArtifact = await deployer.loadArtifact(
    "OssifiableProxy"
  );

  // L1 Bridge
  const L1ERC20BridgeStubArtifact = await deployer.loadArtifact(
    "L1ERC20BridgeStub"
  );
  const l1BridgeContract = await deployer.deploy(L1ERC20BridgeStubArtifact);
  const l1Bridge = await l1BridgeContract.deployed();
  const l1BridgeContractWrong = await deployer.deploy(
    L1ERC20BridgeStubArtifact
  );
  const l1BridgeWrong = await l1BridgeContractWrong.deployed();

  const L1BridgeAddress = utils.undoL1ToL2Alias(l1Bridge.address);

  // L2 Bridge
  const l2ERC20BridgeArtifact = await deployer.loadArtifact("L2ERC20Bridge");
  const l2Erc20BridgeImplContract = await deployer.deploy(
    l2ERC20BridgeArtifact,
    []
  );
  const l2Erc20BridgeImpl = await l2Erc20BridgeImplContract.deployed();

  // proxy
  const l2Erc20BridgeProxyContract = await deployer.deploy(
    ossifiableProxyArtifact,
    [l2Erc20BridgeImpl.address, governor.address, "0x"]
  );
  const l2Erc20BridgeProxy = await l2Erc20BridgeProxyContract.deployed();

  const l2Erc20Bridge = new Contract(
    l2Erc20BridgeProxy.address,
    l2ERC20BridgeArtifact.abi,
    deployer.zkWallet
  );

  const initTx = await l2Erc20Bridge.initialize(
    ethers.utils.getAddress(L1BridgeAddress),
    l1Token.address,
    l2Token.address,
    deployerWallet.address
  );

  await initTx.wait();

  await (await l2Token.setBridge(l2Erc20Bridge.address)).wait();

  return {
    accounts: {
      deployerWallet,
      governor,
      recipient,
      sender,
      stranger,
    },
    stubs: {
      l1Bridge: ethers.utils.getAddress(L1BridgeAddress),
      l1Token: l1Token,
      l2Token: l2Token,
    },
    l2Erc20Bridge,
    l1Erc20Bridge: l1Bridge,
    l1Erc20BridgeWrong: l1BridgeWrong,
    gasLimit: 10_000_000,
  };
}

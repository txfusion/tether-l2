import hre, { ethers } from "hardhat";
import * as path from "path";
import { Wallet as ZkWallet, Provider as ZkProvider } from "zksync-ethers";

import {
  L1ERC20Bridge__factory,
  TransparentUpgradeableProxy__factory,
  ZkSyncStub__factory,
  EmptyContractStub__factory,
  ERC20BridgedStub__factory,
  OssifiableProxy__factory,
} from "../../typechain";
import { L2ERC20BridgeStub__factory } from "../../../l2/typechain";
import { readBytecode } from "../../scripts/utils/utils";

const l2ProxyArtifactsPath = path.join(
  path.resolve(__dirname, "../../.."),
  "l2/artifacts-zk/common/proxy"
  // "l2/artifacts-zk/@openzeppelin/contracts/proxy/transparent"
);

// zksync/l2/artifacts-zk/l2/contracts
const l2ArtifactsPath = path.join(
  path.resolve(__dirname, "../../.."),
  "l2/artifacts-zk/l2/contracts"
);

const L2_BRIDGE_PROXY_BYTECODE = readBytecode(
  l2ProxyArtifactsPath,
  "OssifiableProxy"
  // "TransparentUpgradeableProxy"
);

const L2_BRIDGE_STUB_BYTECODE = readBytecode(
  path.join(l2ArtifactsPath, "stubs"),
  "L2ERC20BridgeStub"
);

const L1_TOKEN_STUB_NAME = "ERC20 Mock";
const L1_TOKEN_STUB_SYMBOL = "ERC20";

export async function setup() {
  const [deployer, governor, sender, recipient, stranger] =
    await hre.ethers.getSigners();

  const provider = new ethers.providers.JsonRpcProvider(
    process.env.ETH_CLIENT_WEB3_URL as string
  );
  const zkProvider = new ZkProvider(process.env.ZKSYNC_PROVIDER_URL as string);
  const zkWallet = new ZkWallet(
    process.env.PRIVATE_KEY as string,
    zkProvider,
    provider
  );

  const zkSyncStub = await new ZkSyncStub__factory(deployer).deploy();

  const l2TokenStub = await new EmptyContractStub__factory(deployer).deploy();
  const l1TokenStub = await new ERC20BridgedStub__factory(deployer).deploy(
    L1_TOKEN_STUB_NAME,
    L1_TOKEN_STUB_SYMBOL
  );

  await l1TokenStub.transfer(
    sender.address,
    ethers.utils.parseUnits("100", "ether")
  );

  const l1Erc20BridgeImpl = await new L1ERC20Bridge__factory(deployer).deploy();

  const requiredValueToInitializeBridge =
    await zkSyncStub.l2TransactionBaseCost(0, 0, 0);

  // const l1Erc20BridgeProxy = await new TransparentUpgradeableProxy__factory(
  const l1Erc20BridgeProxy = await new OssifiableProxy__factory(
    deployer
  ).deploy(l1Erc20BridgeImpl.address, governor.address, "0x");

  const l1Erc20Bridge = L1ERC20Bridge__factory.connect(
    l1Erc20BridgeProxy.address,
    deployer
  );

  const initTx = await l1Erc20Bridge.initialize(
    [L2_BRIDGE_STUB_BYTECODE, L2_BRIDGE_PROXY_BYTECODE],
    [
      l1TokenStub.address,
      l2TokenStub.address,
      governor.address,
      deployer.address,
      zkSyncStub.address,
    ] as any,
    requiredValueToInitializeBridge,
    requiredValueToInitializeBridge
  );

  await initTx.wait();

  return {
    accounts: {
      deployer,
      governor,
      sender,
      recipient,
      stranger,
    },
    stubs: {
      zkSync: zkSyncStub,
      l1Token: l1TokenStub,
      l2Token: l2TokenStub,
      l2Erc20Bridge: L2ERC20BridgeStub__factory.connect(
        await l1Erc20Bridge.l2Bridge(),
        deployer
      ),
    },
    l1Erc20Bridge,
    zkWallet,
  };
}

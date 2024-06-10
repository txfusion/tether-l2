import hre, { ethers } from "hardhat";
import { Wallet as ZkWallet } from "zksync-ethers";
import {
  CHAIN_ID,
  PRIVATE_KEY,
  TETHER_CONSTANTS,
  defaultL1Bridge,
  deployedAddressesFromEnv,
  ethereumProvider,
  zkSyncProvider,
} from "../../../common-utils";
import {
  ERC20BridgedStub__factory,
  EmptyContractStub__factory,
} from "../../typechain";
import { Deployer } from "../../scripts/utils/deployer";
import { L2SharedBridgeStub__factory } from "../../../l2/typechain";

export async function setup() {
  const ADDRESSES = deployedAddressesFromEnv();

  const [_, stranger] = await hre.ethers.getSigners();

  const deployer = new ZkWallet(
    PRIVATE_KEY,
    zkSyncProvider(),
    ethereumProvider()
  );

  const l1TokenStub = await new ERC20BridgedStub__factory(
    deployer._signerL1()
  ).deploy(TETHER_CONSTANTS.NAME, TETHER_CONSTANTS.SYMBOL);
  const l2TokenStub = await new EmptyContractStub__factory(
    deployer._signerL1()
  ).deploy();

  const contractDeployer = new Deployer({
    deployWallet: deployer,
    verbose: true,
  });

  console.log("before deploy (error on deploy impl)");

  const sharedBridgeImplementationAddress =
    await contractDeployer.deploySharedBridgeImplementation();

  await contractDeployer.deploySharedBridgeProxy(
    sharedBridgeImplementationAddress,
    l1TokenStub.address
  );

  await contractDeployer.setParametersSharedBridgeViaOwner();

  return {
    accounts: {
      deployer,
      stranger,
    },
    stubs: {
      l1Token: l1TokenStub,
      l2Token: l2TokenStub,
      l2Erc20Bridge: L2SharedBridgeStub__factory.connect(
        await defaultL1Bridge(deployer).l2BridgeAddress(CHAIN_ID),
        deployer
      ),
    },
    l1SharedBridge: defaultL1Bridge(deployer),
    ADDRESSES,
  };
}

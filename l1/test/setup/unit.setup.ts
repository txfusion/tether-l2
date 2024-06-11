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
  L1SharedBridge__factory,
  TransparentUpgradeableProxy__factory,
} from "../../typechain";
import { L2SharedBridgeStub__factory } from "../../../l2/typechain";
import { constants } from "ethers";
import { HASHES, grantRole } from "../../scripts/utils/roles";

export async function setup() {
  const ADDRESSES = deployedAddressesFromEnv();

  const [_, stranger] = await hre.ethers.getSigners();

  const deployer = new ZkWallet(
    PRIVATE_KEY,
    zkSyncProvider(),
    ethereumProvider()
  );

  // ********** Stubs **********
  let i = 0;
  // console.log(++i);
  // - L1 Token
  const l1TokenStub = await (
    await new ERC20BridgedStub__factory(deployer._signerL1()).deploy(
      TETHER_CONSTANTS.NAME,
      TETHER_CONSTANTS.SYMBOL
    )
  ).deployed();

  // - L2 Token
  // console.log(++i);
  const l2TokenStub = await (
    await new EmptyContractStub__factory(deployer._signerL1()).deploy()
  ).deployed();

  // - L2 Bridge
  // console.log(++i);
  const l2Bridge = await (
    await new L2SharedBridgeStub__factory(deployer._signerL1()).deploy(CHAIN_ID)
  ).deployed();

  // L1 Bridge
  // console.log(++i);
  const l1SharedBridgeImpl = await (
    await new L1SharedBridge__factory(deployer._signerL1()).deploy(
      constants.AddressZero,
      (
        await deployer.getBridgehubContract()
      ).address,
      CHAIN_ID,
      deployedAddressesFromEnv().StateTransition.DiamondProxy
    )
  ).deployed();

  // console.log(++i);
  const l1SharedBridgeProxy = await (
    await new TransparentUpgradeableProxy__factory(deployer._signerL1()).deploy(
      l1SharedBridgeImpl.address,
      l2TokenStub.address, // won't be used
      L1SharedBridge__factory.createInterface().encodeFunctionData(
        "initialize",
        [deployer._signerL1().address, l1TokenStub.address]
      )
    )
  ).deployed();

  // console.log(++i);

  const AMOUNT = ethers.utils.parseUnits("1", "ether");

  if ((await l1TokenStub.balanceOf(deployer.address)).lt(AMOUNT)) {
    await l1TokenStub.bridgeMint(deployer.address, AMOUNT);
  }

  const l1SharedBridge = defaultL1Bridge(
    deployer._signerL1(),
    l1SharedBridgeProxy.address
  );

  await grantRole(
    l1SharedBridge,
    HASHES.ROLES.DEPOSITS_ENABLER_ROLE,
    "DEPOSITS_ENABLER_ROLE",
    [deployer.address]
  );

  await grantRole(
    l1SharedBridge,
    HASHES.ROLES.DEPOSITS_DISABLER_ROLE,
    "DEPOSITS_DISABLER_ROLE",
    [deployer.address]
  );

  await grantRole(
    l1SharedBridge,
    HASHES.ROLES.WITHDRAWALS_ENABLER_ROLE,
    "WITHDRAWALS_ENABLER_ROLE",
    [deployer.address]
  );

  await grantRole(
    l1SharedBridge,
    HASHES.ROLES.WITHDRAWALS_DISABLER_ROLE,
    "WITHDRAWALS_DISABLER_ROLE",
    [deployer.address]
  );

  await (
    await l1SharedBridge.initializeChainGovernance(CHAIN_ID, l2Bridge.address)
  ).wait();

  return {
    accounts: {
      deployer,
      stranger,
    },
    stubs: {
      l1Token: l1TokenStub,
      l2Token: l2TokenStub,
      l2SharedBridge: l2Bridge,
    },
    l1SharedBridge: defaultL1Bridge(
      deployer._signerL1(),
      l1SharedBridgeProxy.address
    ),
    ADDRESSES,
    AMOUNT,
  };
}

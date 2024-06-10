import "@nomiclabs/hardhat-ethers";
import { BigNumber, BigNumberish, Wallet, ethers, providers } from "ethers";

import {
  Governance__factory,
  L1SharedBridge__factory,
  TransparentUpgradeableProxy__factory,
} from "../../typechain";

import {
  CHAIN_ID,
  DeployedAddresses,
  deployedAddressesFromEnv,
  verifyContract,
} from "../../../common-utils";

export interface DeployerConfig {
  deployWallet: Wallet;
  verbose?: boolean;
}

export class Deployer {
  public addresses: DeployedAddresses;
  public deployWallet: Wallet;
  private verbose: boolean;

  constructor(config: DeployerConfig) {
    this.addresses = deployedAddressesFromEnv();
    this.deployWallet = config.deployWallet;
    this.verbose = config.verbose != null ? config.verbose : false;
  }

  public async deploySharedBridgeImplementation(): Promise<string> {
    const l1SharedBridgeContractImpl = await new L1SharedBridge__factory(
      this.deployWallet
    ).deploy(
      this.addresses.Bridgehub.Proxy, // not used: WETH address
      this.addresses.Bridgehub.Proxy,
      BigNumber.from(CHAIN_ID),
      this.addresses.StateTransition.DiamondProxy
    );

    this.addresses.Bridges.L1SharedBridgeImplementation =
      l1SharedBridgeContractImpl.address;
    console.log(
      `CONTRACTS_L1_SHARED_BRIDGE_IMPLEMENTATION_ADDR=${l1SharedBridgeContractImpl.address}`
    );

    verifyContract(l1SharedBridgeContractImpl.address, [
      this.addresses.Bridgehub.Proxy, // not used: WETH address
      this.addresses.Bridgehub.Proxy,
      BigNumber.from(CHAIN_ID),
      this.addresses.StateTransition.DiamondProxy,
    ]);

    return l1SharedBridgeContractImpl.address;
  }

  public async deploySharedBridgeProxy(
    impl: string,
    l1ERC20TokenAddress: string
  ): Promise<string> {
    const l1BridgeContractProxy =
      await new TransparentUpgradeableProxy__factory(this.deployWallet).deploy(
        impl,
        this.addresses.Governance, // TODO: Temporary set governance as proxy admin, so that we can directly control the bridge via owner (since transparent proxy doesn't allow its admin to call implementation's functions)
        L1SharedBridge__factory.createInterface().encodeFunctionData(
          "initialize",
          [this.deployWallet.address, l1ERC20TokenAddress]
        ),
        {
          gasLimit: 10_000_000,
        }
      );

    await l1BridgeContractProxy.deployTransaction.wait();

    this.addresses.Bridges.L1SharedBridgeProxy = l1BridgeContractProxy.address;
    console.log(
      `CONTRACTS_L1_SHARED_BRIDGE_PROXY_ADDR=${l1BridgeContractProxy.address}`
    );

    verifyContract(l1BridgeContractProxy.address, [
      impl,
      this.deployWallet.address,
      "0x",
    ]);

    return l1BridgeContractProxy.address;
  }

  public async setParametersSharedBridgeViaOwner() {
    const proxyAddress = this.addresses.Bridges.L1SharedBridgeProxy;

    const sharedBridge = L1SharedBridge__factory.connect(
      proxyAddress,
      this.deployWallet
    );

    // Note: most likely not needed, as this will be the brand new USDT bridge on zkSync
    console.log("Updating the SharedBridge's legacy L1 ERC20 Bridge");
    await (await sharedBridge.setL1Erc20Bridge(proxyAddress)).wait(1);

    console.log(
      "Updating the SharedBridge's post-diamond upgrade first batch number"
    );
    (
      await sharedBridge.setEraPostDiamondUpgradeFirstBatch(
        process.env.CONTRACTS_ERA_POST_DIAMOND_UPGRADE_FIRST_BATCH ?? 1
      )
    ).wait(1);

    console.log(
      "Updating the SharedBridge's post-legacy bridge first batch number"
    );
    (
      await sharedBridge.setEraPostLegacyBridgeUpgradeFirstBatch(
        process.env.CONTRACTS_ERA_POST_LEGACY_BRIDGE_UPGRADE_FIRST_BATCH ?? 1
      )
    ).wait(1);

    console.log("Updating the SharedBridge's legacy bridge last deposit time");
    (
      await sharedBridge.setEraLegacyBridgeLastDepositTime(
        process.env.CONTRACTS_ERA_LEGACY_UPGRADE_LAST_DEPOSIT_BATCH ?? 1,
        process.env.CONTRACTS_ERA_LEGACY_UPGRADE_LAST_DEPOSIT_TX_NUMBER ?? 0
      )
    ).wait(1);

    if (this.verbose) {
      console.log("Shared bridge has been updated.");
    }
  }

  // Note: left the code just in case, but in our case it's likely that these parameters will be controlled by a centralized entity
  public async setParametersSharedBridgeViaGovernance() {
    const proxyAddress = this.addresses.Bridges.L1SharedBridgeProxy;

    const sharedBridge = L1SharedBridge__factory.connect(
      proxyAddress,
      this.deployWallet
    );
    const data1 = sharedBridge.interface.encodeFunctionData(
      "setL1Erc20Bridge",
      [proxyAddress] // TODO: "this.addresses.Bridges.LegacyERC20BridgeProxy" is the correct address, but it's currently unset due to issues with local setup
    );
    const data2 = sharedBridge.interface.encodeFunctionData(
      "setEraPostDiamondUpgradeFirstBatch",
      [process.env.CONTRACTS_ERA_POST_DIAMOND_UPGRADE_FIRST_BATCH ?? 1]
    );
    const data3 = sharedBridge.interface.encodeFunctionData(
      "setEraPostLegacyBridgeUpgradeFirstBatch",
      [process.env.CONTRACTS_ERA_POST_LEGACY_BRIDGE_UPGRADE_FIRST_BATCH ?? 1]
    );
    const data4 = sharedBridge.interface.encodeFunctionData(
      "setEraLegacyBridgeLastDepositTime",
      [
        process.env.CONTRACTS_ERA_LEGACY_UPGRADE_LAST_DEPOSIT_BATCH ?? 1,
        process.env.CONTRACTS_ERA_LEGACY_UPGRADE_LAST_DEPOSIT_TX_NUMBER ?? 0,
      ]
    );
    await this.executeUpgradeViaGovernance(proxyAddress, 0, data1, true);
    await this.executeUpgradeViaGovernance(proxyAddress, 0, data2);
    await this.executeUpgradeViaGovernance(proxyAddress, 0, data3);
    await this.executeUpgradeViaGovernance(proxyAddress, 0, data4);

    if (this.verbose) {
      console.log("Shared bridge updated with ERC20Bridge address");
    }
  }

  public async executeUpgradeViaGovernance(
    targetAddress: string,
    value: BigNumberish,
    callData: string,
    printOperation: boolean = false
  ) {
    const governance = Governance__factory.connect(
      this.addresses.Governance,
      this.deployWallet
    );

    const operation = {
      calls: [{ target: targetAddress, value: value, data: callData }],
      predecessor: ethers.constants.HashZero,
      salt: ethers.utils.hexlify(ethers.utils.randomBytes(32)),
    };

    if (printOperation) {
      console.log("Operation:", operation);
      console.log(
        "Schedule operation:",
        governance.interface.encodeFunctionData("scheduleTransparent", [
          operation,
          0,
        ])
      );
      console.log(
        `Execute operation value: ${value}, calldata`,
        governance.interface.encodeFunctionData("execute", [operation])
      );
      return;
    }

    await (await governance.scheduleTransparent(operation, 0)).wait();
    if (this.verbose) {
      console.log("Upgrade scheduled");
    }

    await (
      await governance
        .connect(this.deployWallet)
        .execute(operation, { value: value })
    ).wait();

    if (this.verbose) {
      console.log(
        "Upgrade with target",
        targetAddress,
        "executed:",
        await governance.isOperationDone(
          await governance.hashOperation(operation)
        )
      );
    }
  }
}

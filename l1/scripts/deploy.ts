import * as hardhat from "hardhat";
import "@nomiclabs/hardhat-ethers";
import {
  BigNumber,
  BigNumberish,
  Signer,
  Wallet,
  ethers,
  providers,
} from "ethers";
import { getNumberFromEnv } from "./utils/utils";
import { IZkSyncFactory } from "zksync-ethers/build/typechain";
import { L1SharedBridge__factory } from "../typechain/factories/l1/contracts/L1SharedBridge__factory";
import {
  DeployedAddresses,
  deployedAddressesFromEnv,
} from "./utils/deploy-utils";
import { IGovernance__factory } from "../typechain/factories/@matterlabs/zksync-contracts/l1-contracts/contracts/governance/IGovernance__factory";
import {
  L1SharedBridge,
  TransparentUpgradeableProxy__factory,
} from "../typechain";

export const IS_PRODUCTION = (process.env.NODE_ENV as string) === "prod";
export const IS_LOCAL = (process.env.NODE_ENV as string) === "local";

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

  public zkSyncContract(signerOrProvider: Signer | providers.Provider) {
    return IZkSyncFactory.connect(
      this.addresses.StateTransition.DiamondProxy,
      signerOrProvider
    );
  }

  public defaultL1Bridge(
    signerOrProvider: Signer | providers.Provider,
    address?: string
  ): L1SharedBridge {
    return L1SharedBridge__factory.connect(
      address || this.addresses.Bridges.L1SharedBridgeProxy,
      signerOrProvider
    );
  }

  public verifyContract(address: string, constructorArguments?: any[]) {
    if (!IS_LOCAL) {
      if (this.verbose) {
        console.log("Verifying contract...");
      }
      setTimeout(() => {
        hardhat.run("verify:verify", {
          address,
          constructorArguments,
        });
      }, 1_000);
    }
  }

  public async deploySharedBridgeImplementation(): Promise<string> {
    const eraChainId = getNumberFromEnv("CONTRACTS_ERA_CHAIN_ID");

    const l1SharedBridgeContractImpl = await new L1SharedBridge__factory(
      this.deployWallet
    ).deploy(
      this.addresses.Bridgehub.BridgehubProxy, // not used: WETH address
      this.addresses.Bridgehub.BridgehubProxy,
      BigNumber.from(eraChainId),
      this.addresses.StateTransition.DiamondProxy
    );

    console.log(
      `CONTRACTS_L1_SHARED_BRIDGE_IMPLEMENTATION_ADDR=${l1SharedBridgeContractImpl.address}`
    );

    this.verifyContract(l1SharedBridgeContractImpl.address);

    return l1SharedBridgeContractImpl.address;
  }

  public async deploySharedBridgeProxy(
    impl: string,
    l1ERC20TokenAddress: string
  ): Promise<string> {
    const l1BridgeContractProxy =
      await new TransparentUpgradeableProxy__factory(this.deployWallet).deploy(
        impl,
        this.deployWallet.address,
        L1SharedBridge__factory.createInterface().encodeFunctionData(
          "initialize",
          [this.deployWallet.address, l1ERC20TokenAddress]
        ),
        {
          gasLimit: 10_000_000,
        }
      );

    await l1BridgeContractProxy.deployTransaction.wait();

    console.log(
      `CONTRACTS_L1_SHARED_BRIDGE_PROXY_ADDR=${l1BridgeContractProxy.address}`
    );

    this.verifyContract(l1BridgeContractProxy.address, [
      impl,
      this.deployWallet.address,
      "0x",
    ]);

    return l1BridgeContractProxy.address;
  }

  public async setParametersSharedBridge(proxy?: string) {
    const proxyAddress = proxy || this.addresses.Bridges.L1SharedBridgeProxy; // TODO: "this.addresses.Bridges.LegacyERC20BridgeProxy" is the correct address, but it's currently unset due to issues with local setup

    const sharedBridge = L1SharedBridge__factory.connect(
      proxyAddress,
      this.deployWallet
    );
    const data1 = sharedBridge.interface.encodeFunctionData(
      "setL1Erc20Bridge",
      [proxyAddress]
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
    await this.executeUpgrade(proxyAddress, 0, data1);
    await this.executeUpgrade(proxyAddress, 0, data2);
    await this.executeUpgrade(proxyAddress, 0, data3);
    await this.executeUpgrade(proxyAddress, 0, data4);

    if (this.verbose) {
      console.log("Shared bridge updated with ERC20Bridge address");
    }
  }

  public async executeUpgrade(
    targetAddress: string,
    value: BigNumberish,
    callData: string,
    printOperation: boolean = false
  ) {
    const governance = IGovernance__factory.connect(
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
    const scheduleTx = await governance.scheduleTransparent(operation, 0);
    await scheduleTx.wait();
    if (this.verbose) {
      console.log("Upgrade scheduled");
    }
    const executeTX = await governance.execute(operation, { value: value });
    const receipt = await executeTX.wait();
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
    return receipt;
  }
}

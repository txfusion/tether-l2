import * as hardhat from "hardhat";
import "@nomiclabs/hardhat-ethers";

import type { BigNumberish, providers, Signer, Wallet } from "ethers";
import { ethers } from "ethers";
import { Interface } from "ethers/lib/utils";
import { getAddressFromEnv, getNumberFromEnv, hashL2Bytecode } from "./utils";

import {
  DeployedAddresses,
  deployedAddressesFromEnv,
  deployViaCreate2,
} from "./deploy-utils";
import { IBridgehub__factory, L1SharedBridge__factory } from "../../typechain";
import { IGovernance__factory } from "../../typechain/factories/@matterlabs/zksync-contracts/l1-contracts/contracts/governance/IGovernance__factory";
import { ProxyAdmin__factory } from "../../../l2/typechain";

export interface DeployerConfig {
  deployWallet: Wallet;
  addresses?: DeployedAddresses;
  ownerAddress?: string;
  verbose?: boolean;
  bootloaderBytecodeHash?: string;
  defaultAccountBytecodeHash?: string;
}

export interface Operation {
  calls: { target: string; value: BigNumberish; data: string }[];
  predecessor: string;
  salt: string;
}

export type OperationOrString = Operation | string;

export class Deployer {
  public addresses: DeployedAddresses;
  public deployWallet: Wallet;
  public verbose: boolean;
  public chainId: number;
  public ownerAddress: string;

  constructor(config: DeployerConfig) {
    this.deployWallet = config.deployWallet;
    this.verbose = config.verbose != null ? config.verbose : false;
    this.addresses = config.addresses
      ? config.addresses
      : deployedAddressesFromEnv();
    this.ownerAddress =
      config.ownerAddress != null
        ? config.ownerAddress
        : this.deployWallet.address;
    this.chainId = parseInt(process.env.CHAIN_ETH_ZKSYNC_NETWORK_ID!);
  }

  public async deployViaCreate2(
    contractName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any[],
    create2Salt: string,
    ethTxOptions: ethers.providers.TransactionRequest,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    libraries?: any
  ) {
    const result = await deployViaCreate2(
      this.deployWallet,
      contractName,
      args,
      create2Salt,
      ethTxOptions,
      this.addresses.Create2Factory,
      this.verbose,
      libraries
    );
    return result[0];
  }

  // public async deployTransparentProxyAdmin(
  //   create2Salt: string,
  //   ethTxOptions: ethers.providers.TransactionRequest
  // ) {
  //   ethTxOptions.gasLimit ??= 10_000_000;
  //   if (this.verbose) {
  //     console.log("Deploying Proxy Admin");
  //   }
  //   // Note: we cannot deploy using Create2, as the owner of the ProxyAdmin is msg.sender
  //   const contractFactory = await hardhat.ethers.getContractFactory(
  //     "ProxyAdmin",
  //     {
  //       signer: this.deployWallet,
  //     }
  //   );

  //   const proxyAdmin = await contractFactory.deploy(...[ethTxOptions]);
  //   const rec = await proxyAdmin.deployTransaction.wait();

  //   if (this.verbose) {
  //     console.log(
  //       `Proxy admin deployed, gasUsed: ${rec.gasUsed.toString()}, tx hash ${
  //         rec.transactionHash
  //       }, expected address: ${proxyAdmin.address}`
  //     );
  //     console.log(
  //       `CONTRACTS_TRANSPARENT_PROXY_ADMIN_ADDR=${proxyAdmin.address}`
  //     );
  //   }

  //   this.addresses.TransparentProxyAdmin = proxyAdmin.address;

  //   const tx = await proxyAdmin.transferOwnership(this.addresses.Governance);
  //   const receipt = await tx.wait();

  //   if (this.verbose) {
  //     console.log(
  //       `ProxyAdmin ownership transferred to Governance in tx ${
  //         receipt.transactionHash
  //       }, gas used: ${receipt.gasUsed.toString()}`
  //     );
  //   }
  // }

  public async setParametersSharedBridge() {
    const sharedBridge = L1SharedBridge__factory.connect(
      this.addresses.Bridges.L1SharedBridgeProxy,
      this.deployWallet
    );
    const data1 = sharedBridge.interface.encodeFunctionData(
      "setL1Erc20Bridge",
      [this.addresses.Bridges.LegacyERC20BridgeProxy]
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
    await this.executeUpgrade(
      this.addresses.Bridges.L1SharedBridgeProxy,
      0,
      data1
    );
    await this.executeUpgrade(
      this.addresses.Bridges.L1SharedBridgeProxy,
      0,
      data2
    );
    await this.executeUpgrade(
      this.addresses.Bridges.L1SharedBridgeProxy,
      0,
      data3
    );
    await this.executeUpgrade(
      this.addresses.Bridges.L1SharedBridgeProxy,
      0,
      data4
    );
    if (this.verbose) {
      console.log("Shared bridge updated with ERC20Bridge address");
    }
  }

  /// this should be only use for local testing
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
        "Schedule operation: ",
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
        "Upgrade with target ",
        targetAddress,
        "executed: ",
        await governance.isOperationDone(
          await governance.hashOperation(operation)
        )
      );
    }
    return receipt;
  }

  public async deploySharedBridgeImplementation(
    create2Salt: string,
    ethTxOptions: ethers.providers.TransactionRequest
  ) {
    ethTxOptions.gasLimit ??= 10_000_000;
    // const tokens = getTokens();
    // const l1WethToken = tokens.find(
    //   (token: { symbol: string }) => token.symbol == "WETH"
    // )!.address;
    const eraChainId = getNumberFromEnv("CONTRACTS_ERA_CHAIN_ID");
    const eraDiamondProxy = getAddressFromEnv(
      "CONTRACTS_ERA_DIAMOND_PROXY_ADDR"
    );
    const contractAddress = await this.deployViaCreate2(
      "L1SharedBridge", // Note: parametrize contract name
      [
        "", // l1WethToken,
        this.addresses.Bridgehub.BridgehubProxy,
        eraChainId,
        eraDiamondProxy,
      ],
      create2Salt,
      ethTxOptions
    );

    if (this.verbose) {
      console.log(
        `With era chain id ${eraChainId} and era diamond proxy ${eraDiamondProxy}`
      );
      console.log(`CONTRACTS_L1_SHARED_BRIDGE_IMPL_ADDR=${contractAddress}`);
    }

    this.addresses.Bridges.L1SharedBridgeImplementation = contractAddress;
  }

  public async deploySharedBridgeProxy(
    create2Salt: string,
    ethTxOptions: ethers.providers.TransactionRequest
  ) {
    ethTxOptions.gasLimit ??= 10_000_000;
    const initCalldata = new Interface(
      hardhat.artifacts.readArtifactSync("L1SharedBridge").abi
    ).encodeFunctionData("initialize", [this.addresses.Governance]);
    const contractAddress = await this.deployViaCreate2(
      "TransparentUpgradeableProxy",
      [
        this.addresses.Bridges.L1SharedBridgeImplementation,
        this.addresses.TransparentProxyAdmin,
        initCalldata,
      ],
      create2Salt,
      ethTxOptions
    );

    if (this.verbose) {
      console.log(`CONTRACTS_L1_SHARED_BRIDGE_PROXY_ADDR=${contractAddress}`);
    }

    this.addresses.Bridges.L1SharedBridgeProxy = contractAddress;
  }

  // Note: we probably don't need this since we won't be registering as the main shared bridge
  // public async registerSharedBridge(
  //   ethTxOptions: ethers.providers.TransactionRequest
  // ) {
  //   ethTxOptions.gasLimit ??= 10_000_000;
  //   const bridgehub = this.bridgehubContract(this.deployWallet);

  //   /// registering ETH as a valid token, with address 1.
  //   const tx2 = await bridgehub.addToken(ADDRESS_ONE);
  //   const receipt2 = await tx2.wait();

  //   const tx3 = await bridgehub.setSharedBridge(
  //     this.addresses.Bridges.SharedBridgeProxy
  //   );
  //   const receipt3 = await tx3.wait();
  //   if (this.verbose) {
  //     console.log(
  //       `Shared bridge was registered, gas used: ${receipt3.gasUsed.toString()} and ${receipt2.gasUsed.toString()}`
  //     );
  //   }
  // }

  public async deploySharedBridgeContracts(
    create2Salt: string,
    gasPrice?: BigNumberish,
    nonce?: any
  ) {
    nonce = nonce
      ? parseInt(nonce)
      : await this.deployWallet.getTransactionCount();

    await this.deploySharedBridgeImplementation(create2Salt, {
      gasPrice,
      nonce: nonce,
    });
    await this.deploySharedBridgeProxy(create2Salt, {
      gasPrice,
      nonce: nonce + 1,
    });
    // await this.registerSharedBridge({ gasPrice, nonce: nonce + 2 });
  }

  public bridgehubContract(signerOrProvider: Signer | providers.Provider) {
    return IBridgehub__factory.connect(
      this.addresses.Bridgehub.BridgehubProxy,
      signerOrProvider
    );
  }

  public governanceContract(signerOrProvider: Signer | providers.Provider) {
    return IGovernance__factory.connect(
      this.addresses.Governance,
      signerOrProvider
    );
  }

  public defaultSharedBridge(signerOrProvider: Signer | providers.Provider) {
    return L1SharedBridge__factory.connect(
      this.addresses.Bridges.L1SharedBridgeProxy,
      signerOrProvider
    );
  }

  // public baseTokenContract(signerOrProvider: Signer | providers.Provider) {
  //   return ERC20Factory.connect(this.addresses.BaseToken, signerOrProvider);
  // }

  public proxyAdminContract(signerOrProvider: Signer | providers.Provider) {
    return ProxyAdmin__factory.connect(
      this.addresses.TransparentProxyAdmin,
      signerOrProvider
    );
  }
}

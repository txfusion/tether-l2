import { BigNumber, Wallet, ethers } from "ethers";
import * as hre from "hardhat";

import { IERC20__factory, IBridgehub__factory } from "../../../l1/typechain";

import {
  DeployedAddresses,
  SYSTEM_CONFIG_CONSTANTS,
  applyL1ToL2Alias,
  computeL2Create2Address,
  deployedAddressesFromEnv,
  getNumberFromEnv,
  hashL2Bytecode,
  defaultL1Bridge,
} from "../../../common-utils";

export const L2_SHARED_BRIDGE_ABI =
  hre.artifacts.readArtifactSync("L2SharedBridge").abi;
export const L2_SHARED_BRIDGE_IMPLEMENTATION_BYTECODE =
  hre.artifacts.readArtifactSync("L2SharedBridge").bytecode;

export const priorityTxMaxGasLimit = getNumberFromEnv(
  "CONTRACTS_PRIORITY_TX_MAX_GAS_LIMIT"
);
export const REQUIRED_L2_GAS_PRICE_PER_PUBDATA =
  SYSTEM_CONFIG_CONSTANTS.REQUIRED_L2_GAS_PRICE_PER_PUBDATA;

export interface DeployerConfig {
  deployWallet: Wallet;
  verbose?: boolean;
}

export class Deployer {
  private addresses: DeployedAddresses;
  public deployWallet: Wallet;
  private verbose: boolean;

  constructor(config: DeployerConfig) {
    this.addresses = deployedAddressesFromEnv();
    this.deployWallet = config.deployWallet;
    this.verbose = config.verbose != null ? config.verbose : false;
  }

  async deploySharedBridgeImplOnL2ThroughL1(
    chainId: string,
    gasPrice: ethers.BigNumberish,
    localLegacyBridgeTesting: boolean = false
  ) {
    if (this.verbose) {
      console.log("Deploying L2SharedBridge implementation...");
    }

    const eraChainId = SYSTEM_CONFIG_CONSTANTS.ERA_CHAIN_ID;
    if (!L2_SHARED_BRIDGE_IMPLEMENTATION_BYTECODE) {
      throw new Error("L2_SHARED_BRIDGE_IMPLEMENTATION_BYTECODE not found");
    }

    if (this.verbose) {
      console.log("Computing L2SharedBridge implementation's address...");
    }

    const l2SharedBridgeImplAddress = computeL2Create2Address(
      this.deployWallet,
      L2_SHARED_BRIDGE_IMPLEMENTATION_BYTECODE,
      ethers.utils.defaultAbiCoder.encode(
        ["uint256"],
        [localLegacyBridgeTesting ? 0 : eraChainId]
      ),
      ethers.constants.HashZero
    );

    this.addresses.Bridges.L2SharedBridgeImplementation =
      l2SharedBridgeImplAddress;

    if (this.verbose) {
      console.log("Create2 address computed, attempting to deploy from L1...");
    }

    // TODO: request from API how many L2 gas needs for the transaction.
    await (
      await this.create2DeployFromL1(
        BigNumber.from(chainId),
        this.deployWallet,
        L2_SHARED_BRIDGE_IMPLEMENTATION_BYTECODE,
        ethers.utils.defaultAbiCoder.encode(
          ["uint256"],
          [localLegacyBridgeTesting ? 0 : eraChainId]
        ),
        ethers.constants.HashZero,
        priorityTxMaxGasLimit,
        gasPrice,
        []
      )
    ).wait();

    console.log(
      `CONTRACTS_L2_SHARED_BRIDGE_IMPL_ADDR=${l2SharedBridgeImplAddress}`
    );
  }

  async deploySharedBridgeProxyOnL2ThroughL1(
    chainId: string,
    gasPrice: ethers.BigNumberish
  ) {
    const l1SharedBridge = defaultL1Bridge(this.deployWallet);
    if (this.verbose) {
      console.log("Deploying L2SharedBridge Proxy");
    }

    /// prepare proxyInitializationParams
    const l2GovernorAddress = applyL1ToL2Alias(this.addresses.Governance);
    const l2SharedBridgeInterface = new ethers.utils.Interface(
      hre.artifacts.readArtifactSync("L2SharedBridge").abi
    );

    const proxyInitializationParams =
      l2SharedBridgeInterface.encodeFunctionData("initialize", [
        l1SharedBridge.address,
        this.addresses.Tokens.L1Token,
        this.addresses.Tokens.L2Token,
        l2GovernorAddress,
      ]);

    /// prepare constructor data
    const l2SharedBridgeProxyConstructorData = ethers.utils.arrayify(
      new ethers.utils.AbiCoder().encode(
        ["address", "address", "bytes"],
        [
          this.addresses.Bridges.L2SharedBridgeImplementation,
          l2GovernorAddress,
          proxyInitializationParams,
        ]
      )
    );

    /// loading TransparentUpgradeableProxy bytecode
    const L2_SHARED_BRIDGE_PROXY_BYTECODE = hre.artifacts.readArtifactSync(
      "TransparentUpgradeableProxy"
    ).bytecode;

    /// compute L2SharedBridgeProxy address
    const l2SharedBridgeProxyAddress = computeL2Create2Address(
      this.deployWallet,
      L2_SHARED_BRIDGE_PROXY_BYTECODE,
      l2SharedBridgeProxyConstructorData,
      ethers.constants.HashZero
    );
    this.addresses.Bridges.L2SharedBridgeProxy = l2SharedBridgeProxyAddress;

    /// deploy L2SharedBridgeProxy
    // TODO: request from API how many L2 gas needs for the transaction.
    await (
      await this.create2DeployFromL1(
        BigNumber.from(chainId),
        this.deployWallet,
        L2_SHARED_BRIDGE_PROXY_BYTECODE,
        l2SharedBridgeProxyConstructorData,
        ethers.constants.HashZero,
        priorityTxMaxGasLimit,
        gasPrice
      )
    ).wait();

    console.log(
      `CONTRACTS_L2_SHARED_BRIDGE_PROXY_ADDR=${l2SharedBridgeProxyAddress}`
    );
  }

  private async create2DeployFromL1(
    chainId: ethers.BigNumberish,
    wallet: ethers.Wallet,
    bytecode: ethers.BytesLike,
    constructor: ethers.BytesLike,
    create2Salt: ethers.BytesLike,
    l2GasLimit: ethers.BigNumberish,
    gasPrice?: ethers.BigNumberish,
    extraFactoryDeps?: ethers.BytesLike[]
  ) {
    const bridgehub = IBridgehub__factory.connect(
      this.addresses.Bridgehub.Proxy,
      wallet
    );

    const deployerSystemContracts = new ethers.utils.Interface(
      hre.artifacts.readArtifactSync("IContractDeployer").abi
    );

    gasPrice ??= await bridgehub.provider.getGasPrice();
    const expectedCost = await bridgehub.l2TransactionBaseCost(
      chainId,
      gasPrice,
      l2GasLimit,
      REQUIRED_L2_GAS_PRICE_PER_PUBDATA
    );

    const baseTokenAddress = await bridgehub.baseToken(chainId);
    const ethIsBaseToken =
      SYSTEM_CONFIG_CONSTANTS.ADDRESS_ONE == baseTokenAddress;

    if (!ethIsBaseToken) {
      const baseToken = IERC20__factory.connect(baseTokenAddress, wallet);
      const baseTokenBridge = this.addresses.Bridges.L1SharedBridgeProxy;

      await (await baseToken.approve(baseTokenBridge, expectedCost)).wait();
    }

    return await bridgehub.requestL2TransactionDirect(
      {
        chainId,
        l2Contract: SYSTEM_CONFIG_CONSTANTS.DEPLOYER_SYSTEM_CONTRACT_ADDRESS,
        mintValue: expectedCost,
        l2Value: 0,
        l2Calldata: deployerSystemContracts.encodeFunctionData("create2", [
          create2Salt,
          hashL2Bytecode(bytecode),
          constructor,
        ]),
        l2GasLimit,
        l2GasPerPubdataByteLimit: REQUIRED_L2_GAS_PRICE_PER_PUBDATA,
        factoryDeps: extraFactoryDeps
          ? [bytecode, ...extraFactoryDeps]
          : [bytecode],
        refundRecipient: wallet.address,
      },
      { value: ethIsBaseToken ? expectedCost : 0, gasPrice }
    );
  }
}

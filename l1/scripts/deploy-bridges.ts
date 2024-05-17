import "@nomiclabs/hardhat-ethers";
import { web3Provider } from "./utils/utils";
import { Wallet } from "ethers";
import { Deployer } from "./deploy";
import {
  OssifiableProxy__factory,
  L1ERC20Bridge__factory,
  ERC20Token__factory,
} from "../typechain/index";
import { ERC20_BRIDGED_CONSTANTS } from "./utils/constants";

const PRIVATE_KEY = process.env.PRIVATE_KEY as string;
const IS_LOCAL = (process.env.NODE_ENV as string) === "local";

const provider = web3Provider();

// TODO: Initialize implementations
async function main() {
  const deployWallet = new Wallet(PRIVATE_KEY, provider);
  const adminAddress = deployWallet.address;

  const deployer = new Deployer({
    deployWallet,
    verbose: true,
  });

  if (IS_LOCAL) {
    /**
     * L1 Token
     */
    const L1ERC20Token = await new ERC20Token__factory(deployWallet).deploy(
      ERC20_BRIDGED_CONSTANTS.NAME,
      ERC20_BRIDGED_CONSTANTS.SYMBOL,
      ERC20_BRIDGED_CONSTANTS.DECIMALS
    );

    console.log(`CONTRACTS_L1_TOKEN_ADDR=${L1ERC20Token.address}`);
  }

  /**
   * L1ERC20Bridge Implementation
   */
  const l1ERC20BridgeContractImpl = await new L1ERC20Bridge__factory(
    deployWallet
  ).deploy();

  console.log(
    `CONTRACTS_L1_BRIDGE_IMPLEMENTATION_ADDR=${l1ERC20BridgeContractImpl.address}`
  );

  deployer.verifyContract(l1ERC20BridgeContractImpl.address);

  /**
   * L1ERC20Bridge Proxy
   */
  // const l1BridgeContractProxy = await new TransparentUpgradeableProxy__factory(
  const l1BridgeContractProxy = await new OssifiableProxy__factory(
    deployWallet
  ).deploy(l1ERC20BridgeContractImpl.address, adminAddress, "0x", {
    gasLimit: 10_000_000,
  });

  console.log(
    `CONTRACTS_L1_BRIDGE_PROXY_ADDR=${l1BridgeContractProxy.address}`
  );

  deployer.verifyContract(l1BridgeContractProxy.address, [
    l1ERC20BridgeContractImpl.address,
    adminAddress,
    "0x",
  ]);
}

main().catch((error) => {
  throw error;
});

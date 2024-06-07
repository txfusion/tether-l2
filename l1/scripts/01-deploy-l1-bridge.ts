import "@nomiclabs/hardhat-ethers";
import { Wallet } from "ethers";
import { web3Provider } from "./utils/utils";
import { Deployer } from "./deploy";
import { ERC20Token__factory } from "../typechain/index";
import { L1_ERC20_BRIDGED_CONSTANTS } from "./utils/constants";

const PRIVATE_KEY = process.env.PRIVATE_KEY as string;
const IS_LOCAL = (process.env.NODE_ENV as string) === "local";
const ZKSYNC_CHAIN_ID = Number(process.env.ZKSYNC_CHAIN_ID);

const provider = web3Provider();

// TODO: Initialize implementations
async function main() {
  const deployWallet = new Wallet(PRIVATE_KEY, provider);

  const deployer = new Deployer({
    deployWallet,
    verbose: true,
  });

  let l1ERC20TokenAddress = deployer.addresses.Tokens.L1Token;
  if (IS_LOCAL) {
    /**
     * 0. Deploy USDT token, if needed (only in local)
     */
    const L1ERC20Token = await new ERC20Token__factory(deployWallet).deploy(
      L1_ERC20_BRIDGED_CONSTANTS.NAME,
      L1_ERC20_BRIDGED_CONSTANTS.SYMBOL,
      L1_ERC20_BRIDGED_CONSTANTS.DECIMALS
    );

    console.log(`CONTRACTS_L1_TOKEN_ADDR=${L1ERC20Token.address}`);
    l1ERC20TokenAddress = L1ERC20Token.address;
  }

  /**
   * 1. Deploy L1SharedBridge Implementation
   */
  const sharedBridgeImplementationAddress =
    await deployer.deploySharedBridgeImplementation();

  /**
   * 2. Deploy and initialize the L1SharedBridge Proxy
   */
  await deployer.deploySharedBridgeProxy(
    sharedBridgeImplementationAddress,
    l1ERC20TokenAddress
  );

  /**
   * 3. Set zkSync parameters
   */
  await deployer.setParametersSharedBridge();
}

main().catch((error) => {
  throw error;
});

import "@nomiclabs/hardhat-ethers";
import { Wallet } from "ethers";
import { Deployer } from "./utils/deployer";
import { ERC20Token__factory } from "../typechain";
import {
  IS_LOCAL,
  PRIVATE_KEY,
  TETHER_CONSTANTS,
  ethereumProvider,
} from "../../common-utils";

const provider = ethereumProvider();

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
      TETHER_CONSTANTS.NAME,
      TETHER_CONSTANTS.SYMBOL,
      TETHER_CONSTANTS.DECIMALS
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
}

main().catch((error) => {
  throw error;
});

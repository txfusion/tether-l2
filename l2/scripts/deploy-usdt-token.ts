import * as hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Contract, Wallet } from "zksync-web3";

import {
  ERC20_BRIDGED_CONSTANTS,
  PRIVATE_KEY,
  ADDRESSES,
} from "./utils/constants";
import { verify } from "./utils/verify";

const ERC20_BRIDGED_TOKEN_CONTRACT_NAME = "ERC20BridgedUpgradeable";
const OSSIFIABLE_PROXY_CONTRACT_NAME = "OssifiableProxy";

async function main() {
  const zkWallet = new Wallet(PRIVATE_KEY);
  const deployer = new Deployer(hre, zkWallet);
  const adminAddress = deployer.zkWallet.address;

  /**
   * Artifacts
   */
  const erc20TokenArtifact = await deployer.loadArtifact(
    ERC20_BRIDGED_TOKEN_CONTRACT_NAME
  );
  const ossifiableProxyArtifact = await deployer.loadArtifact(
    OSSIFIABLE_PROXY_CONTRACT_NAME
  );

  /**
   * L2ERC20Bridge Implementation
   */
  const l2TokenContractImpl = await deployer.deploy(erc20TokenArtifact);
  const erc20Token = await l2TokenContractImpl.deployed();

  console.log(`CONTRACTS_L2_TOKEN_IMPLEMENTATION_ADDR=${erc20Token.address}`);
  await verify(erc20Token.address);
  /**
   * L2ERC20Bridge Proxy
   */
  const l2TokenContractProxyContract = await deployer.deploy(
    ossifiableProxyArtifact,
    [l2TokenContractImpl.address, adminAddress, "0x"],
    {
      gasLimit: 10_000_000,
    }
  );

  const l2TokenContractProxy = await l2TokenContractProxyContract.deployed();

  console.log(`CONTRACTS_L2_TOKEN_PROXY_ADDR=${l2TokenContractProxy.address}`);

  await verify(l2TokenContractProxy.address);

  /**
   * Initializing Implementation
   */

  // TODO: tidy up

  console.log("~~~ Initializing Implementation ~~~");
  const erc20BridgedImplementation = new Contract(
    l2TokenContractImpl.address,
    erc20TokenArtifact.abi,
    deployer.zkWallet
  );

  const initImplTx = await erc20BridgedImplementation[
    "__ERC20BridgedUpgradeable_init(string,string,uint8)"
  ](
    ERC20_BRIDGED_CONSTANTS.NAME,
    ERC20_BRIDGED_CONSTANTS.SYMBOL,
    ERC20_BRIDGED_CONSTANTS.DECIMALS
  );

  await initImplTx.wait();

  const initImplV2Tx = await erc20BridgedImplementation[
    "__ERC20BridgedUpgradeable_init_v2(address)"
  ](deployer.zkWallet.address);
  await initImplV2Tx.wait();

  console.log("Implementation initialized");
}

main().catch((error) => {
  throw error;
});

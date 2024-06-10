import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";

dotenv.config({ path: `../.env` });

const IS_LOCAL = (process.env.NODE_ENV as string) === "local";

const config: HardhatUserConfig & { etherscan: { apiKey: string } } = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10_000, // Note: 100_000 runs breaks the Spurious Dragon 24576 bytes size limit, 10_000 doesn't
      },
    },
  },
  ...(!IS_LOCAL && { defaultNetwork: "eth_network" }),
  networks: {
    eth_network: {
      url: process.env.ETH_CLIENT_WEB3_URL as string,
    },
  },
  etherscan: {
    apiKey: process.env.ETHER_SCAN_API_KEY as string,
  },
  paths: {
    root: "../",
    sources: "l1/contracts",
    cache: "l1/cache",
    artifacts: "l1/artifacts",
  },
  mocha: {
    timeout: 100000000,
  },
};

export default config;

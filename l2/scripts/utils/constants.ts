export const ADDRESSES = {
  L2_BRIDGE_PROXY_ADDR: process.env.CONTRACTS_L2_BRIDGE_PROXY_ADDR as string,
  L2_TOKEN_ADDR: process.env.CONTRACTS_L2_TOKEN_PROXY_ADDR as string,
};

export const PRIVATE_KEY = process.env.PRIVATE_KEY as string;

export const ZKSYNC_PROVIDER_URL = process.env.ZKSYNC_PROVIDER_URL as string;

export const ERC20_BRIDGED_CONSTANTS = {
  CONTRACT_NAME: "TetherZkSync",
  NAME: "Tether USDT",
  SYMBOL: "USDT",
  DECIMALS: 6,
};

export const IS_LOCAL = process.env.CHAIN_ETH_NETWORK === "localhost";

export const ZKSYNC_ADDRESSES = {
  l1: {
    l1Token: process.env.CONTRACTS_L1_TOKEN_ADDR as string,
    l1Bridge: process.env.CONTRACTS_L1_BRIDGE_PROXY_ADDR as string,
  },
  l2: {
    l2Token: process.env.CONTRACTS_L2_TOKEN_PROXY_ADDR as string,
    l2Bridge: process.env.CONTRACTS_L2_BRIDGE_PROXY_ADDR as string,
  },
};

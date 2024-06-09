import { ethers } from "ethers";
import { Provider } from "zksync-ethers";

/// ******************* Ethereum *******************
export function ethereumClientURL() {
  return process.env.ETH_CLIENT_WEB3_URL as string;
}

export function ethereumProvider() {
  const provider = new ethers.providers.JsonRpcProvider(ethereumClientURL());

  // Check that `CHAIN_ETH_NETWORK` variable is set. If not, it's most likely because
  // the variable was renamed. As this affects the time to deploy contracts in localhost
  // scenario, it surely deserves a warning.
  const network = process.env.CHAIN_ETH_NETWORK;
  if (!network) {
    console.warn("CHAIN_ETH_NETWORK env variable is not set.");
  }

  // Short polling interval for local network
  if (network === "localhost") {
    provider.pollingInterval = 100;
  }

  return provider;
}
/// *************************************************

/// ******************* zkSync *******************
export function zkSyncClientURL() {
  return process.env.ZKSYNC_PROVIDER_URL as string;
}

export function zkSyncProvider(): Provider {
  return new Provider(zkSyncClientURL());
}
/// **********************************************

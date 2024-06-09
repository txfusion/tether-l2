export const PRIVATE_KEY = process.env.PRIVATE_KEY as string;
export const IS_LOCAL = process.env.CHAIN_ETH_NETWORK === "localhost";
export const CHAIN_ID = getNumberFromEnv("CONTRACTS_CHAIN_ID");

export function getNumberFromEnv(envName: string): string {
  const number = process.env[envName];
  if (!number) {
    return "";
  }
  if (!/^([1-9]\d*|0)$/.test(number)) {
    throw new Error(
      `Incorrect number format number in ${envName} env: ${number}`
    );
  }
  return number;
}

export function getAddressFromEnv(envName: string): string {
  const address = process.env[envName];
  if (!address) {
    return "";
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(
      `Incorrect address format hash in ${envName} env: ${address}`
    );
  }
  return address;
}

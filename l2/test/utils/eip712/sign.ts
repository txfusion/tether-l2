import {
  TypedDataSigner,
  TypedDataDomain,
} from "@ethersproject/abstract-signer";
import { EIP712Operations, EIP712TypeDefinition, eip712Types } from "./types";
import { BigNumberish, ethers } from "ethers";

export async function signTypedData(
  domain: TypedDataDomain,
  types: EIP712TypeDefinition,
  value: any,
  signer: TypedDataSigner
): Promise<string> {
  try {
    const signature = await signer._signTypedData(domain, types, value);
    return signature;
  } catch (error) {
    console.log("[signTypedData]::error ", error);
    return "";
  }
}

export const getEIP712Operation = (
  op: EIP712Operations,
  toSign: any
): { type: EIP712TypeDefinition; data: any } => {
  switch (op) {
    case EIP712Operations.PERMIT:
      return { type: eip712Types.permit, data: { ...toSign } };
    case EIP712Operations.TRANSFER_WITH_AUTHORIZATION:
      return {
        type: eip712Types.transferWithAuthorization,
        data: { ...toSign },
      };
    case EIP712Operations.RECEIVE_WITH_AUTHORIZATION:
      return {
        type: eip712Types.receiveWithAuthorization,
        data: { ...toSign },
      };
    case EIP712Operations.CANCEL_AUTHORIZATION:
      return {
        type: eip712Types.cancelAuthorization,
        data: { ...toSign },
      };
  }
};

export function domainSeparator(
  name: string,
  version: string,
  chainId: BigNumberish,
  verifyingContract: string
): string {
  const eip712Domain: ethers.TypedDataDomain = {
    name,
    version,
    chainId,
    verifyingContract,
  };

  return ethers.utils._TypedDataEncoder.hashDomain(eip712Domain);
}

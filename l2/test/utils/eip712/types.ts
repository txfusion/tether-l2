export type SolidityTypesAsString =
  | "address"
  | "bytes"
  | "bytes1"
  | "bytes2"
  | "bytes3"
  | "bytes4"
  | "bytes5"
  | "bytes6"
  | "bytes7"
  | "bytes8"
  | "bytes9"
  | "bytes10"
  | "bytes11"
  | "bytes12"
  | "bytes13"
  | "bytes14"
  | "bytes15"
  | "bytes16"
  | "bytes17"
  | "bytes18"
  | "bytes19"
  | "bytes20"
  | "bytes21"
  | "bytes22"
  | "bytes23"
  | "bytes24"
  | "bytes25"
  | "bytes26"
  | "bytes27"
  | "bytes28"
  | "bytes29"
  | "bytes30"
  | "bytes31"
  | "bytes32"
  | "string"
  | "uint8"
  | "uint256";

export type EIP712TypeDefinition = {
  [key: string]: {
    name: string;
    type: SolidityTypesAsString;
  }[];
};

export enum EIP712Operations {
  PERMIT = 0,
  TRANSFER_WITH_AUTHORIZATION = 1,
  RECEIVE_WITH_AUTHORIZATION = 2,
  CANCEL_AUTHORIZATION = 3,
}

export interface EIP712Types {
  permit: EIP712TypeDefinition;
  transferWithAuthorization: EIP712TypeDefinition;
  receiveWithAuthorization: EIP712TypeDefinition;
  cancelAuthorization: EIP712TypeDefinition;
}

const withAuthorization: any = [
  { name: "from", type: "address" },
  { name: "to", type: "address" },
  { name: "value", type: "uint256" },
  { name: "validAfter", type: "uint256" },
  { name: "validBefore", type: "uint256" },
  { name: "nonce", type: "bytes32" },
];

export const eip712Types: EIP712Types = {
  permit: {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  transferWithAuthorization: {
    TransferWithAuthorization: withAuthorization,
  },
  receiveWithAuthorization: {
    ReceiveWithAuthorization: withAuthorization,
  },
  cancelAuthorization: {
    CancelAuthorization: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
  },
};

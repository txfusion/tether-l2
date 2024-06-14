import { ethers } from "ethers";
import { CREATE2_PREFIX } from "./constants";

export function hashL2Bytecode(bytecode: ethers.BytesLike): Uint8Array {
  // For getting the consistent length we first convert the bytecode to UInt8Array
  const bytecodeAsArray = ethers.utils.arrayify(bytecode);
  if (bytecodeAsArray.length % 32 != 0) {
    throw new Error("The bytecode length in bytes must be divisible by 32");
  }

  const hashStr = ethers.utils.sha256(bytecodeAsArray);
  const hash = ethers.utils.arrayify(hashStr);

  // Note that the length of the bytecode
  // should be provided in 32-byte words.
  const bytecodeLengthInWords = bytecodeAsArray.length / 32;
  if (bytecodeLengthInWords % 2 == 0) {
    throw new Error("Bytecode length in 32-byte words must be odd");
  }
  const bytecodeLength = ethers.utils.arrayify(bytecodeAsArray.length / 32);
  if (bytecodeLength.length > 2) {
    throw new Error("Bytecode length must be less than 2^16 bytes");
  }
  // The bytecode should always take the first 2 bytes of the bytecode hash,
  // so we pad it from the left in case the length is smaller than 2 bytes.
  const bytecodeLengthPadded = ethers.utils.zeroPad(bytecodeLength, 2);

  const codeHashVersion = new Uint8Array([1, 0]);
  hash.set(codeHashVersion, 0);
  hash.set(bytecodeLengthPadded, 2);

  return hash;
}

export function computeL2Create2Address(
  deployWallet: ethers.Wallet,
  bytecode: ethers.BytesLike,
  constructorInput: ethers.BytesLike,
  create2Salt: ethers.BytesLike
) {
  const senderBytes = ethers.utils.hexZeroPad(deployWallet.address, 32);
  const bytecodeHash = hashL2Bytecode(bytecode);
  const constructorInputHash = ethers.utils.keccak256(constructorInput);

  const data = ethers.utils.keccak256(
    ethers.utils.concat([
      CREATE2_PREFIX,
      senderBytes,
      create2Salt,
      bytecodeHash,
      constructorInputHash,
    ])
  );

  return ethers.utils.hexDataSlice(data, 12);
}

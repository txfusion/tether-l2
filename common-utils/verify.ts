import * as hre from "hardhat";

import { IS_LOCAL } from "./env";

export function verifyContract(address: string, constructorArguments?: any[]) {
  if (!IS_LOCAL) {
    console.log("Verifying contract...");

    setTimeout(() => {
      hre.run("verify:verify", {
        address,
        constructorArguments,
      });
    }, 1_000);
  }
}

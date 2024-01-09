import { run } from "hardhat";
import { IS_LOCAL } from "./constants";

export async function verify(address: string) {
  if (!IS_LOCAL) {
    console.log("Verifying contract...");
    return run("verify:verify", {
      address,
    });
  }
}

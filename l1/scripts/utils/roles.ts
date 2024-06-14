import { Contract } from "ethers";

export const HASHES = {
  ROLES: {
    DEFAULT_ADMIN_ROLE:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    DEPOSITS_ENABLER_ROLE:
      "0x8db9de3c1b3423341016781f736ef2e360dbf014ccfad19a27b77a6401944318",
    DEPOSITS_DISABLER_ROLE:
      "0x5a50eb08a36004975be700424bea439ce8d6e8ef4ee9ed3fb1956c79aefc10b0",
    WITHDRAWALS_ENABLER_ROLE:
      "0x20d69dd64a9fea74f8c1665e0e4b7b6e28a0a05f64795cb9af45dfd7e4bae4d7",
    WITHDRAWALS_DISABLER_ROLE:
      "0x9c84f2a235b4733df447b9ae11df08214fe1a117fbc772c9ffab6856070258f8",
  },
};

export async function grantRole(
  contract: Contract,
  roleBytecode: string,
  roleName: string,
  targets: string[],
  verbose: boolean = false
) {
  for (const target of targets) {
    const hasL2ExecutorDepositDisablerRoleL2 = await contract.hasRole(
      roleBytecode,
      target
    );

    if (!hasL2ExecutorDepositDisablerRoleL2) {
      const tx = await contract.grantRole(roleBytecode, target, {
        gasLimit: 10_000_000,
      });
      await tx.wait();

      const isRoleGranted = await contract.hasRole(roleBytecode, target);

      if (!isRoleGranted) {
        console.warn(`Error granting ${roleName} to ${target}`);
        return;
      }
    }

    if (verbose) {
      console.log(`${roleName}:${target}`);
    }
  }
}

export async function revokeRole(
  contract: Contract,
  roleBytecode: string,
  roleName: string,
  target: string
) {
  const hasRole = await contract.hasRole(roleBytecode, target);

  if (hasRole) {
    const tx = await contract.revokeRole(roleBytecode, target, {
      gasLimit: 10_000_000,
    });
    await tx.wait();

    const hadRole = await contract.hasRole(roleBytecode, target);
    if (!hadRole) {
      console.log(`Revoked ${roleName}: ${target}`);
    }
  }
  console.log(`${target} doesn't possess ${roleName}`);
}

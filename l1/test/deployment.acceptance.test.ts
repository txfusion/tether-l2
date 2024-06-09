import { ethers } from "ethers";
import { assert } from "chai";

import { HASHES } from "../scripts/utils/hashes";
import { setup } from "./setup/deployment.setup";
import {
  DeployedAddresses,
  TETHER_CONSTANTS,
  deployedAddressesFromEnv,
} from "../../common-utils";

describe("~~~ Tether on zkSync Era :: deployment acceptance test ~~~", async () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  let ADDRESSES: DeployedAddresses;

  before("Setting up the context", async () => {
    ctx = await setup();
    ADDRESSES = deployedAddressesFromEnv();
  });

  describe("=== L1 Bridge ===", async () => {
    it("*** Proxy admin ***", async () => {
      const {
        l1: { proxy },
        accounts: { deployer },
      } = ctx;
      assert.equal(await proxy.l1Bridge.proxy__getAdmin(), deployer.address);
    });

    it("*** Bridge admin ***", async () => {
      const {
        l1: { l1Bridge },
        accounts: { deployer },
      } = ctx;
      assert.isTrue(
        await l1Bridge.hasRole(
          HASHES.ROLES.DEFAULT_ADMIN_ROLE,
          deployer.address
        )
      );
    });

    it("*** L1 Token ***", async () => {
      const {
        l1: { l1Bridge },
      } = ctx;

      assert.equal(await l1Bridge.l1Token(), ADDRESSES.Tokens.L1Token);
    });

    it("*** L2 Token ***", async () => {
      const {
        l1: { l1Bridge },
      } = ctx;

      assert.equal(await l1Bridge.l2Token(), ADDRESSES.Tokens.L2Token);
    });

    it("*** L2 Bridge ***", async () => {
      const {
        l1: { l1Bridge },
      } = ctx;

      assert.equal(
        await l1Bridge.l2Bridge(),
        ADDRESSES.Bridges.L2SharedBridgeProxy
      );
    });

    describe("*** Deposits ***", async () => {
      it("Are enabled?", async () => {
        const {
          l1: { l1Bridge },
          depositsEnabled,
        } = ctx;

        assert.equal(await l1Bridge.isDepositsEnabled(), depositsEnabled.l1);
      });

      it("Enablers", async () => {
        const {
          l1: { l1Bridge },
          accounts: { deployer },
        } = ctx;

        const enablerAddresses = [deployer.address];

        for (const enabler of enablerAddresses) {
          assert.isTrue(
            await l1Bridge.hasRole(HASHES.ROLES.DEPOSITS_ENABLER_ROLE, enabler)
          );
        }
      });

      it("Disablers", async () => {
        const {
          l1: { l1Bridge },
          accounts: { deployer },
        } = ctx;

        const disablerAddresses = [deployer.address];

        for (const disabler of disablerAddresses) {
          assert.isTrue(
            await l1Bridge.hasRole(
              HASHES.ROLES.DEPOSITS_DISABLER_ROLE,
              disabler
            )
          );
        }
      });
    });

    describe("*** Withdrawals ***", async () => {
      it("Are enabled?", async () => {
        const {
          l1: { l1Bridge },
          withdrawalsEnabled,
        } = ctx;

        assert.equal(
          await l1Bridge.isWithdrawalsEnabled(),
          withdrawalsEnabled.l1
        );
      });

      it("Enablers", async () => {
        const {
          l1: { l1Bridge },
          accounts: { deployer },
        } = ctx;

        const enablerAddresses = [deployer.address];

        for (const enabler of enablerAddresses) {
          assert.isTrue(
            await l1Bridge.hasRole(
              HASHES.ROLES.WITHDRAWALS_ENABLER_ROLE,
              enabler
            )
          );
        }
      });

      it("Disablers", async () => {
        const {
          l1: { l1Bridge },
          accounts: { deployer },
        } = ctx;

        const disablerAddresses = [deployer.address];

        for (const disabler of disablerAddresses) {
          assert.isTrue(
            await l1Bridge.hasRole(
              HASHES.ROLES.WITHDRAWALS_DISABLER_ROLE,
              disabler
            )
          );
        }
      });
    });
  });

  describe("=== L2 Bridge ===", async () => {
    it("*** Bridge Admin ***", async () => {
      const {
        l2: { l2Bridge },
        accounts: { deployer },
      } = ctx;
      assert.isTrue(
        await l2Bridge.hasRole(
          HASHES.ROLES.DEFAULT_ADMIN_ROLE,
          deployer.address
        )
      );
    });

    it("** L1 Token ***", async () => {
      const {
        l2: { l2Bridge },
      } = ctx;

      assert.equal(await l2Bridge.l1Token(), ADDRESSES.Tokens.L1Token);
    });

    it("** L2 Token ***", async () => {
      const {
        l2: { l2Bridge },
      } = ctx;

      assert.equal(await l2Bridge.l2Token(), ADDRESSES.Tokens.L2Token);
    });

    it("** L1 Bridge ***", async () => {
      const {
        l2: { l2Bridge },
      } = ctx;

      assert.equal(
        await l2Bridge.l1Bridge(),
        ADDRESSES.Bridges.L1SharedBridgeProxy
      );
    });

    describe("*** Deposits ***", async () => {
      it("Are enabled?", async () => {
        const {
          l2: { l2Bridge },
          depositsEnabled,
        } = ctx;

        assert.equal(await l2Bridge.isDepositsEnabled(), depositsEnabled.l2);
      });

      it("Enablers", async () => {
        const {
          l2: { l2Bridge },
          accounts: { deployer },
        } = ctx;

        const enablerAddresses = [deployer.address];

        for (const enabler of enablerAddresses) {
          assert.isTrue(
            await l2Bridge.hasRole(HASHES.ROLES.DEPOSITS_ENABLER_ROLE, enabler)
          );
        }
      });

      it("Disablers", async () => {
        const {
          l2: { l2Bridge },
          accounts: { deployer },
        } = ctx;

        const disablerAddresses = [deployer.address];

        for (const disabler of disablerAddresses) {
          assert.isTrue(
            await l2Bridge.hasRole(
              HASHES.ROLES.DEPOSITS_DISABLER_ROLE,
              disabler
            )
          );
        }
      });
    });

    describe("*** Withdrawals ***", async () => {
      it("Are enabled?", async () => {
        const {
          l2: { l2Bridge },
          withdrawalsEnabled,
        } = ctx;

        assert.equal(
          await l2Bridge.isWithdrawalsEnabled(),
          withdrawalsEnabled.l2
        );
      });

      it("Enablers", async () => {
        const {
          l1: { l1Bridge },
          accounts: { deployer },
        } = ctx;

        const enablerAddresses = [deployer.address];

        for (const enabler of enablerAddresses) {
          assert.isTrue(
            await l1Bridge.hasRole(
              HASHES.ROLES.WITHDRAWALS_ENABLER_ROLE,
              enabler
            )
          );
        }
      });

      it("Disablers", async () => {
        const {
          l2: { l2Bridge },
          accounts: { deployer },
        } = ctx;

        const disablerAddresses = [deployer.address];

        for (const disabler of disablerAddresses) {
          assert.isTrue(
            await l2Bridge.hasRole(
              HASHES.ROLES.WITHDRAWALS_DISABLER_ROLE,
              disabler
            )
          );
        }
      });
    });
  });

  describe("=== L2 Token ===", async () => {
    it("*** Name *** ", async () => {
      const {
        l2: { l2Token },
      } = ctx;

      assert.equal(await l2Token.name(), TETHER_CONSTANTS.NAME);
    });

    it("*** Symbol *** ", async () => {
      const {
        l2: { l2Token },
      } = ctx;

      assert.equal(await l2Token.symbol(), TETHER_CONSTANTS.SYMBOL);
    });

    it("*** Decimals *** ", async () => {
      const {
        l2: { l2Token },
      } = ctx;

      assert.equal(await l2Token.decimals(), TETHER_CONSTANTS.DECIMALS);
    });

    it("*** Total supply *** ", async () => {
      const {
        l2: { l2Token },
      } = ctx;

      assert.equal(+ethers.utils.formatEther(await l2Token.totalSupply()), 0);
    });

    it("*** Bridge *** ", async () => {
      const {
        l2: { l2Token },
      } = ctx;

      assert.equal(
        await l2Token.bridge(),
        ADDRESSES.Bridges.L2SharedBridgeProxy
      );
    });
  });
});

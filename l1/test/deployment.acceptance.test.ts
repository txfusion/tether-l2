import { ethers } from "ethers";
import { utils } from "zksync-web3";
import { assert } from "chai";
import { defaultAbiCoder } from "ethers/lib/utils";

import { HASHES } from "../scripts/utils/hashes";
import { setup } from "./setup/deployment.setup";
import { ERC20_BRIDGED_CONSTANTS } from "../../l2/scripts/utils/constants";
import { ProxyAdmin__factory } from "../../l2/typechain";
import { ZKSYNC_ADDRESSES } from "./e2e/e2e";

describe("~~~ Tether on zkSync Era :: deployment acceptance test ~~~", async () => {
  let ctx: Awaited<ReturnType<typeof setup>>;

  before("Setting up the context", async () => {
    ctx = await setup();
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

      assert.equal(await l1Bridge.l1Token(), ZKSYNC_ADDRESSES.l1.l1Token);
    });

    it("*** L2 Token ***", async () => {
      const {
        l1: { l1Bridge },
      } = ctx;

      assert.equal(await l1Bridge.l2Token(), ZKSYNC_ADDRESSES.l2.l2Token);
    });

    it("*** L2 Bridge ***", async () => {
      const {
        l1: { l1Bridge },
      } = ctx;

      assert.equal(await l1Bridge.l2Bridge(), ZKSYNC_ADDRESSES.l2.l2Bridge);
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

  //   it("L1 Executor :: proxy admin", async () => {
  //     const {
  //       l1: {
  //         proxy: { l1Executor },
  //       },
  //     } = ctx;

  //     assert.equal(await l1Executor.proxy__getAdmin(), ZKSYNC_ADDRESSES.l1.agent);
  //   });

  //   it("L1 Executor :: owner", async () => {
  //     const {
  //       l1: { l1Executor },
  //     } = ctx;

  //     assert.equal(await l1Executor.owner(), ZKSYNC_ADDRESSES.l1.agent);
  //   });

  /**
   *
   * L2
   *
   */

  describe("=== L2 Bridge ===", async () => {
    // it("*** Proxy admin ***", async () => {
    //   const {
    //     l2: { proxy },
    //   } = ctx;
    //   assert.equal(
    //     await proxy.l2Bridge.proxy__getAdmin(),
    //     ZKSYNC_ADDRESSES.l2.govExecutor
    //   );
    // });

    it("*** Bridge admin ***", async () => {
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

      assert.equal(await l2Bridge.l1Token(), ZKSYNC_ADDRESSES.l1.l1Token);
    });

    it("** L2 Token ***", async () => {
      const {
        l2: { l2Bridge },
      } = ctx;

      assert.equal(await l2Bridge.l2Token(), ZKSYNC_ADDRESSES.l2.l2Token);
    });

    it("** L1 Bridge ***", async () => {
      const {
        l2: { l2Bridge },
      } = ctx;

      assert.equal(await l2Bridge.l1Bridge(), ZKSYNC_ADDRESSES.l1.l1Bridge);
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
    // it("*** Proxy admin ***", async () => {
    //   const {
    //     l2: {
    //       accounts: { deployer },
    //     },
    //     zkProvider,
    //   } = ctx;

    //   const proxyAdminAddressBytes32 = await zkProvider.getStorageAt(
    //     ZKSYNC_ADDRESSES.l2.l2Token,
    //     "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103" // storage where admin address is stored
    //   ); // returns bytes32

    //   const proxyAdminAddress = defaultAbiCoder.decode(
    //     ["address"],
    //     proxyAdminAddressBytes32
    //   ); // returns Result => []

    //   const proxyAdminContract = ProxyAdmin__factory.connect(
    //     proxyAdminAddress[0], // proxyAdminAddress 0 index is the location of address
    //     deployer
    //   );

    //   const L2TokenProxyAdminOwner = await proxyAdminContract.owner();

    //   assert.equal(
    //     L2TokenProxyAdminOwner,
    //     ethers.utils.getAddress(
    //       utils.applyL1ToL2Alias(ZKSYNC_ADDRESSES.l1.l1Executor)
    //     )
    //   );
    // });

    it("*** Name *** ", async () => {
      const {
        l2: { l2Token },
      } = ctx;

      assert.equal(await l2Token.name(), ERC20_BRIDGED_CONSTANTS.NAME);
    });

    it("*** Symbol *** ", async () => {
      const {
        l2: { l2Token },
      } = ctx;

      assert.equal(await l2Token.symbol(), ERC20_BRIDGED_CONSTANTS.SYMBOL);
    });

    it("*** Decimals *** ", async () => {
      const {
        l2: { l2Token },
      } = ctx;

      assert.equal(await l2Token.decimals(), ERC20_BRIDGED_CONSTANTS.DECIMALS);
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

      assert.equal(await l2Token.bridge(), ZKSYNC_ADDRESSES.l2.l2Bridge);
    });
  });
});

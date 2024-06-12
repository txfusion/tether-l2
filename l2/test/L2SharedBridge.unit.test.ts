import { assert, expect } from "chai";
import { Contract } from "zksync-ethers";
import { describe } from "mocha";
import { setup } from "./setup/bridge.setup";

describe("~~~~~ L2 Shared Bridge ~~~~~", async () => {
  let context: Awaited<ReturnType<typeof setup>>;

  beforeEach("Setting up the context", async () => {
    context = await setup();
  });

  describe("=== Getters ===", async () => {
    it("*** L1 Bridge ***", async () => {
      const { l2SharedBridge, l1SharedBridge } = context;
      assert.equal(
        await l2SharedBridge.l1SharedBridge(),
        l1SharedBridge.address
      );
    });

    it("*** L1 Token ***", async () => {
      const { l2SharedBridge, stubs } = context;
      assert.equal(await l2SharedBridge.l1Token(), stubs.l1Token.address);
    });

    it("*** L2 Token ***", async () => {
      const { l2SharedBridge, stubs } = context;
      assert.equal(await l2SharedBridge.l2Token(), stubs.l2Token.address);
    });
  });

  describe("=== Withdraw ===", async () => {
    it("Withdrawals enabled?", async () => {
      const { l2SharedBridge } = context;

      assert.isTrue(await l2SharedBridge.isWithdrawalsEnabled());
    });

    it("Blocked address cannot finalize deposit", async () => {
      const {
        l2SharedBridge,
        accounts: { recipient },
        stubs: { l2Token },
        gasLimit,
        AMOUNT,
      } = context;

      await (await l2Token.addToBlockedList(recipient.address)).wait();
      assert(await l2Token.isBlocked(recipient.address), "user is not blocked");

      expect(
        await l2SharedBridge
          .connect(recipient)
          .withdraw(recipient.address, l2Token.address, AMOUNT, {
            gasLimit,
          })
      ).to.be.revertedWith("Blocked: account is blocked");
    });

    it("Unsupported L2 Token", async () => {
      const {
        l2SharedBridge,
        accounts: { recipient, stranger },
        gasLimit,
        l1SharedBridge,
        AMOUNT,
      } = context;

      expect(
        await l2SharedBridge
          .connect(recipient)
          .withdraw(recipient.address, stranger.address, AMOUNT, {
            gasLimit,
          })
      ).to.be.revertedWithCustomError(
        l2SharedBridge,
        "BridgeableTokensUpgradable__ErrorUnsupportedL2Token"
      );
    });

    it(">>> Works as expected", async () => {
      const {
        l2SharedBridge,
        accounts: { deployerWallet },
        stubs,
        gasLimit,
        AMOUNT,
      } = context;

      const l2_TotalSupply_BeforeWith = await stubs.l2Token.totalSupply();
      const deployer_Balance_BeforeWith = await stubs.l2Token.balanceOf(
        deployerWallet.address
      );

      // changes in token supply between two transactions
      let deltaL2TokenSupply;

      await expect(
        l2SharedBridge.withdraw(
          deployerWallet.address,
          stubs.l2Token.address,
          AMOUNT,
          { gasLimit }
        )
      )
        .to.emit(l2SharedBridge, "WithdrawalInitiated")
        .withArgs(
          deployerWallet.address,
          deployerWallet.address,
          stubs.l2Token.address,
          AMOUNT
        );

      const deployer_Balance_AfterWith = await stubs.l2Token.balanceOf(
        deployerWallet.address
      );

      expect(deployer_Balance_BeforeWith.sub(deployer_Balance_AfterWith)).to.eq(
        AMOUNT,
        "Change of the recipient balance of L2 token after withdrawal must match withdraw amount"
      );

      const l2_TotalSupply_AfterFirstTx = await stubs.l2Token.totalSupply();

      deltaL2TokenSupply = l2_TotalSupply_BeforeWith.sub(
        l2_TotalSupply_AfterFirstTx
      );

      expect(deltaL2TokenSupply).to.eq(
        AMOUNT,
        "Total supply of l2Token should decrease"
      );
    });
  });

  describe("=== Finalize Deposit ===", async () => {
    it("Deposits enabled?", async () => {
      const { l2SharedBridge } = context;

      assert.isTrue(await l2SharedBridge.isDepositsEnabled());
    });

    it("Unsupported L1 Token", async () => {
      const {
        l2SharedBridge,
        accounts: { recipient, stranger },
        gasLimit,
        l1SharedBridge,
        AMOUNT,
      } = context;

      expect(
        await l2SharedBridge
          .connect(l1SharedBridge)
          .finalizeDeposit(
            recipient.address,
            recipient.address,
            stranger.address,
            AMOUNT,
            "0x",
            {
              gasLimit,
            }
          )
      ).to.be.revertedWithCustomError(
        l2SharedBridge,
        "BridgeableTokensUpgradable__ErrorUnsupportedL1Token"
      );
    });

    it("Invalid L1 Caller", async () => {
      const {
        l2SharedBridge,
        accounts: { recipient },
        stubs: { l1Token },
        gasLimit,
        AMOUNT,
      } = context;

      expect(
        await l2SharedBridge
          .connect(recipient)
          .finalizeDeposit(
            recipient.address,
            recipient.address,
            l1Token.address,
            AMOUNT,
            "0x",
            {
              gasLimit,
            }
          )
      ).to.be.revertedWith("mq");
    });

    it("Blocked address cannot finalize deposit", async () => {
      const {
        l2SharedBridge,
        accounts: { recipient },
        stubs: { l1Token, l2Token },
        gasLimit,
        l1SharedBridge,
        AMOUNT,
      } = context;

      await (await l2Token.addToBlockedList(recipient.address)).wait();
      assert(await l2Token.isBlocked(recipient.address), "user is not blocked");

      expect(
        await l2SharedBridge
          .connect(l1SharedBridge)
          .finalizeDeposit(
            recipient.address,
            recipient.address,
            l1Token.address,
            AMOUNT,
            "0x",
            {
              gasLimit,
            }
          )
      ).to.be.revertedWith("Blocked: account is blocked");
    });

    // skipping because it's hard to test due to aliasing
    it.skip(">>> Works as expected", async () => {
      const {
        l2SharedBridge,
        accounts: { recipient },
        stubs: { l1Token, l2Token },
        l1SharedBridge,
        gasLimit,
        AMOUNT,
      } = context;

      let deltaL2TokenSupply;
      const l2_TotalSupply_Before = await l2Token.totalSupply();

      await expect(
        await l2SharedBridge
          .connect(l1SharedBridge)
          .finalizeDeposit(
            recipient.address,
            recipient.address,
            l1Token.address,
            AMOUNT,
            "0x",
            {
              gasLimit,
            }
          )
      )
        .to.emit(l2SharedBridge, "FinalizeDeposit")
        .withArgs(
          recipient.address,
          recipient.address,
          l2Token.address,
          AMOUNT
        );

      const l2_TotalSupply_AfterFirstTx = await l2Token.totalSupply();

      console.log(
        "L2 token's suplly after finalize deposit:",
        l2_TotalSupply_AfterFirstTx
      );

      deltaL2TokenSupply = l2_TotalSupply_AfterFirstTx.sub(
        l2_TotalSupply_Before
      );

      expect(deltaL2TokenSupply).to.eq(
        AMOUNT,
        "Total supply of l2Token should increase"
      );
    });
  });
});

/**
 * initializeBridgesWithAssertion
 * @param bridge Bridge Contract
 * @param defaultAdminAddress Address of the contract/account that admins the bridge
 */
async function initializeBridgesWithAssertion(
  bridge: Contract,
  defaultAdminAddress: string
) {
  const isInitialized = await bridge.isInitialized();

  if (!isInitialized) {
    // grant DEFAULT_ADMIN_ROLE role
    const initTx = await bridge["initialize(address)"](defaultAdminAddress, {
      gasLimit: 10_000_000,
    });
    await initTx.wait();
  }
  assert.isTrue(await bridge.isInitialized());
}

/**
 * enableDepositsWithAssertions
 * @param l2SharedBridge L2 ERC20 Bridge
 * @param defaultAdminAddress Address of the contract/account that admins the bridge
 * @param depositEnablerAddress Address of the contract/account that can enable deposits
 */
async function enableDepositsWithAssertions(
  l2SharedBridge: Contract,
  defaultAdminAddress: string,
  depositEnablerAddress: string
) {
  const isDepositsEnabled = await l2SharedBridge.isDepositsEnabled();

  await initializeBridgesWithAssertion(l2SharedBridge, defaultAdminAddress);

  if (!isDepositsEnabled) {
    // grant DEPOSITS_ENABLER_ROLE role
    await l2SharedBridge.grantRole(
      await l2SharedBridge.DEPOSITS_ENABLER_ROLE(),
      depositEnablerAddress,
      { gasLimit: 10_000_000 }
    );

    const enableTx = await l2SharedBridge.enableDeposits({
      gasLimit: 10_000_000,
    });
    await enableTx.wait();
  }

  assert.isTrue(await l2SharedBridge.isDepositsEnabled());
}

/**
 * enableWithdrawalsWithAssertions
 * @param l2SharedBridge L2 ERC20 Bridge
 * @param defaultAdminAddress Address of the contract/account that admins the bridge
 * @param withdrawalEnablerAddress Address of the contract/account that can enable withdrawals
 */
async function enableWithdrawalsWithAssertions(
  l2SharedBridge: Contract,
  defaultAdminAddress: string,
  withdrawalEnablerAddress: string
) {
  const isWithdrawalsEnabled = await l2SharedBridge.isWithdrawalsEnabled();

  await initializeBridgesWithAssertion(l2SharedBridge, defaultAdminAddress);

  if (!isWithdrawalsEnabled) {
    // grant WITHDRAWALS_ENABLER_ROLE role
    await l2SharedBridge.grantRole(
      await l2SharedBridge.WITHDRAWALS_ENABLER_ROLE(),
      withdrawalEnablerAddress,
      { gasLimit: 10_000_000 }
    );

    const enableTx = await l2SharedBridge.enableWithdrawals({
      gasLimit: 10_000_000,
    });
    await enableTx.wait();
  }

  assert.isTrue(await l2SharedBridge.isWithdrawalsEnabled());
}

import { assert, expect } from "chai";
import { Contract } from "zksync-ethers";
import { ethers } from "ethers";
import { describe } from "mocha";
import { setup } from "./setup/bridge.setup";

describe("~~~~~ L2ERC20Bridge ~~~~~", async () => {
  let context: Awaited<ReturnType<typeof setup>>;

  before("Setting up the context", async () => {
    context = await setup();
  });

  beforeEach("re-enable deposits/withdrawals", async () => {
    const {
      l2Erc20Bridge,
      accounts: { deployerWallet },
    } = context;

    await enableDepositsWithAssertions(
      l2Erc20Bridge,
      deployerWallet.address,
      deployerWallet.address
    );

    await enableWithdrawalsWithAssertions(
      l2Erc20Bridge,
      deployerWallet.address,
      deployerWallet.address
    );
  });

  describe("=== Getters ===", async () => {
    it("*** L1 Bridge ***", async () => {
      const { l2Erc20Bridge, stubs } = context;
      assert.equal(await l2Erc20Bridge.l1Bridge(), stubs.l1Bridge);
    });

    it("*** L1 Token ***", async () => {
      const { l2Erc20Bridge, stubs } = context;
      assert.equal(await l2Erc20Bridge.l1Token(), stubs.l1Token.address);
    });

    it("*** L2 Token ***", async () => {
      const { l2Erc20Bridge, stubs } = context;
      assert.equal(await l2Erc20Bridge.l2Token(), stubs.l2Token.address);
    });

    describe("*** L1 Token Address ***", async () => {
      it("Correct L1 token", async () => {
        const { l2Erc20Bridge, stubs } = context;
        const fetchedL1TokenAddress = await l2Erc20Bridge.l1TokenAddress(
          stubs.l2Token.address
        );
        assert.equal(fetchedL1TokenAddress, stubs.l1Token.address);
      });

      it("Incorrect L1 Token", async () => {
        const { l2Erc20Bridge, accounts } = context;
        const wrongTokenAddress = accounts.stranger.address;

        const fetchedL1TokenAddress = await l2Erc20Bridge.l1TokenAddress(
          wrongTokenAddress
        );
        assert.equal(fetchedL1TokenAddress, ethers.constants.AddressZero);
      });
    });

    describe("*** L2 Token Address ***", async () => {
      it("Correct L2 Token", async () => {
        const { l2Erc20Bridge, stubs } = context;

        const fetchedL2TokenAddress = await l2Erc20Bridge.l2TokenAddress(
          stubs.l1Token.address
        );
        assert.equal(fetchedL2TokenAddress, stubs.l2Token.address);
      });

      it("Incorrect L2 Token", async () => {
        const { l2Erc20Bridge, accounts } = context;
        const wrongTokenAddress = accounts.stranger.address;

        const fetchedL2TokenAddress = await l2Erc20Bridge.l2TokenAddress(
          wrongTokenAddress
        );
        assert.equal(fetchedL2TokenAddress, ethers.constants.AddressZero);
      });
    });
  });

  describe("=== Deposit ===", async () => {
    it("Deposits enabled?", async () => {
      const { l2Erc20Bridge } = context;

      assert.isTrue(await l2Erc20Bridge.isDepositsEnabled());
    });

    it("Wrong L1 Token address", async () => {
      const { l2Erc20Bridge, accounts, l1Erc20Bridge, gasLimit } = context;
      const { deployerWallet, sender, recipient } = accounts;

      await enableDepositsWithAssertions(
        l2Erc20Bridge,
        deployerWallet.address,
        deployerWallet.address
      );
      const amount = ethers.utils.parseUnits("1", "ether");
      const l2TxGasLimit = ethers.utils.parseUnits("1000", "gwei");
      const l2TxGasPerPubdataByte = ethers.utils.parseUnits("800", "wei");

      const wrongL1TokenAddress = accounts.stranger.address;

      expect(
        await l1Erc20Bridge.deposit(
          recipient.address,
          wrongL1TokenAddress,
          amount,
          l2TxGasLimit,
          l2TxGasPerPubdataByte,
          sender.address,
          l2Erc20Bridge.address,
          "0x",
          { gasLimit }
        )
      ).to.be.revertedWith("ErrorUnsupportedL1Token");
    });

    it("Wrong domain sender", async () => {
      const { l2Erc20Bridge, accounts, stubs, l1Erc20BridgeWrong, gasLimit } =
        context;
      const { deployerWallet, sender, recipient } = accounts;

      await enableDepositsWithAssertions(
        l2Erc20Bridge,
        deployerWallet.address,
        deployerWallet.address
      );
      const amount = ethers.utils.parseUnits("1", "ether");
      const l2TxGasLimit = ethers.utils.parseUnits("1000", "gwei");
      const l2TxGasPerPubdataByte = ethers.utils.parseUnits("800", "wei");

      expect(
        await l1Erc20BridgeWrong.deposit(
          recipient.address,
          stubs.l1Token.address,
          amount,
          l2TxGasLimit,
          l2TxGasPerPubdataByte,
          sender.address,
          l2Erc20Bridge.address,
          "0x",
          { gasLimit }
        )
      ).to.be.revertedWith("ErrorWrongCrossDomainSender");
    });

    it("Wrong (zero) value", async () => {
      const { l2Erc20Bridge, accounts, stubs, l1Erc20Bridge, gasLimit } =
        context;
      const { deployerWallet, sender, recipient } = accounts;

      await enableDepositsWithAssertions(
        l2Erc20Bridge,
        deployerWallet.address,
        deployerWallet.address
      );
      const amount = ethers.utils.parseUnits("1", "ether");
      const l2TxGasLimit = ethers.utils.parseUnits("1000", "gwei");
      const l2TxGasPerPubdataByte = ethers.utils.parseUnits("800", "wei");
      const ethValue = ethers.utils.parseUnits("1", "ether");

      expect(
        await l1Erc20Bridge.deposit(
          recipient.address,
          stubs.l1Token.address,
          amount,
          l2TxGasLimit,
          l2TxGasPerPubdataByte,
          sender.address,
          l2Erc20Bridge.address,
          "0x",
          { gasLimit, value: ethValue }
        )
      ).to.be.revertedWith("The deposit amount can't be zero");
    });

    it("Frozen address cannot finalize deposit", async () => {
      const { l2Erc20Bridge, accounts, stubs, l1Erc20Bridge, gasLimit } =
        context;
      const { deployerWallet, sender, recipient } = accounts;

      await enableDepositsWithAssertions(
        l2Erc20Bridge,
        deployerWallet.address,
        deployerWallet.address
      );

      const amount = ethers.utils.parseUnits("1", "ether");
      const l2TxGasLimit = ethers.utils.parseUnits("1000", "gwei");
      const l2TxGasPerPubdataByte = ethers.utils.parseUnits("800", "wei");

      // await expect(stubs.l2Token.setFrozenStatus(recipient.address, true)).to
      //   .not.be.reverted;
      // TODO: fix after .reverted starts working again
      await (
        await stubs.l2Token.setFrozenStatus(recipient.address, true)
      ).wait();
      assert(
        await stubs.l2Token.isFrozen(recipient.address),
        "user is not frozen"
      );

      expect(
        await l1Erc20Bridge.deposit(
          recipient.address,
          stubs.l1Token.address,
          amount,
          l2TxGasLimit,
          l2TxGasPerPubdataByte,
          sender.address,
          l2Erc20Bridge.address,
          "0x",
          { gasLimit }
        )
      ).to.be.revertedWithCustomError(stubs.l2Token, "OnlyNotFrozenAddress");

      // Revert back to old state
      // await expect(stubs.l2Token.setFrozenStatus(recipient.address, false)).to
      //   .not.be.reverted;
      // TODO: fix after .reverted starts working again
      await (
        await stubs.l2Token.setFrozenStatus(recipient.address, false)
      ).wait();
      assert(
        (await stubs.l2Token.isFrozen(recipient.address)) == false,
        "user is still frozen"
      );
    });

    it(">>> Works as expected", async () => {
      const { l2Erc20Bridge, accounts, stubs, l1Erc20Bridge, gasLimit } =
        context;
      const { deployerWallet, sender, recipient } = accounts;

      await enableDepositsWithAssertions(
        l2Erc20Bridge,
        deployerWallet.address,
        deployerWallet.address
      );

      const amount = ethers.utils.parseUnits("1", "ether");
      const l2TxGasLimit = ethers.utils.parseUnits("1000", "gwei");
      const l2TxGasPerPubdataByte = ethers.utils.parseUnits("800", "wei");
      // changes in token supply between two transactions
      let deltaL2TokenSupply;
      const l2_TotalSupply_Before = await stubs.l2Token.totalSupply();

      await expect(
        l1Erc20Bridge.deposit(
          recipient.address,
          stubs.l1Token.address,
          amount,
          l2TxGasLimit,
          l2TxGasPerPubdataByte,
          sender.address,
          l2Erc20Bridge.address,
          "0x",
          { gasLimit }
        )
      )
        .to.emit(l2Erc20Bridge, "FinalizeDeposit")
        .withArgs(
          deployerWallet.address,
          recipient.address,
          stubs.l2Token.address,
          amount
        );

      const l2_TotalSupply_AfterFirstTx = await stubs.l2Token.totalSupply();

      deltaL2TokenSupply = l2_TotalSupply_AfterFirstTx.sub(
        l2_TotalSupply_Before
      );

      expect(deltaL2TokenSupply).to.eq(
        amount,
        "Total supply of l2Token should increase"
      );

      await expect(
        l1Erc20Bridge.deposit(
          recipient.address,
          stubs.l1Token.address,
          amount,
          l2TxGasLimit,
          l2TxGasPerPubdataByte,
          sender.address,
          l2Erc20Bridge.address,
          "0x",
          { gasLimit }
        )
      )
        .to.emit(l2Erc20Bridge, "FinalizeDeposit")
        .withArgs(
          deployerWallet.address,
          recipient.address,
          stubs.l2Token.address,
          amount
        );

      const l2_TotalSupply_AfterSecondTx = await stubs.l2Token.totalSupply();

      deltaL2TokenSupply = l2_TotalSupply_AfterSecondTx.sub(
        l2_TotalSupply_AfterFirstTx
      );

      expect(deltaL2TokenSupply).to.eq(
        amount,
        "Total supply of l2Token should increase"
      );
    });
  });

  describe("=== Withdraw ===", async () => {
    it("Withdrawals enabled?", async () => {
      const { l2Erc20Bridge } = context;

      assert.isTrue(await l2Erc20Bridge.isWithdrawalsEnabled());
    });

    it("Frozen address cannot withdraw", async () => {
      const { l2Erc20Bridge, accounts, stubs, gasLimit } = context;
      const { recipient } = accounts;

      const amount = ethers.utils.parseUnits("0.5", "ether");

      // expect(await stubs.l2Token.setFrozenStatus(recipient.address, true)).to
      //   .not.be.reverted;
      // TODO: fix after .reverted starts working again
      await (
        await stubs.l2Token.setFrozenStatus(recipient.address, true)
      ).wait();
      assert(
        await stubs.l2Token.isFrozen(recipient.address),
        "user is not frozen"
      );

      expect(
        await l2Erc20Bridge
          .connect(recipient)
          .withdraw(recipient.address, stubs.l2Token.address, amount, {
            gasLimit,
          })
      ).to.be.revertedWithCustomError(stubs.l2Token, "OnlyNotFrozenAddress");

      // Revert back to old state

      // expect(await stubs.l2Token.setFrozenStatus(recipient.address, false)).to
      //   .not.be.reverted;
      // TODO: fix after .reverted starts working again
      await (
        await stubs.l2Token.setFrozenStatus(recipient.address, false)
      ).wait();
      assert(
        (await stubs.l2Token.isFrozen(recipient.address)) == false,
        "user is still frozen"
      );
    });

    it("Wrong L2 token", async () => {
      const { l2Erc20Bridge, accounts, stubs, gasLimit } = context;

      const { deployerWallet, recipient } = accounts;

      await enableWithdrawalsWithAssertions(
        l2Erc20Bridge,
        deployerWallet.address,
        deployerWallet.address
      );
      const amount = ethers.utils.parseUnits("1", "ether");
      const wrongTokenAddress = stubs.l1Token.address;

      expect(
        await l2Erc20Bridge
          .connect(recipient)
          .withdraw(recipient.address, wrongTokenAddress, amount, {
            gasLimit,
          })
      ).to.be.revertedWithCustomError(l2Erc20Bridge, "ErrorUnsupportedL2Token");
    });

    it(">>> Works as expected", async () => {
      const { l2Erc20Bridge, accounts, stubs, gasLimit } = context;
      const { deployerWallet } = accounts;

      await enableWithdrawalsWithAssertions(
        l2Erc20Bridge,
        deployerWallet.address,
        deployerWallet.address
      );

      const l2_TotalSupply_BeforeWith = await stubs.l2Token.totalSupply();

      const deployer_Balance_BeforeWith = await stubs.l2Token.balanceOf(
        deployerWallet.address
      );

      const amount = ethers.utils.parseUnits("0.5", "ether");

      // changes in token supply between two transactions
      let deltaL2TokenSupply;

      await expect(
        l2Erc20Bridge.withdraw(
          deployerWallet.address,
          stubs.l2Token.address,
          amount,
          { gasLimit }
        )
      )
        .to.emit(l2Erc20Bridge, "WithdrawalInitiated")
        .withArgs(
          deployerWallet.address,
          deployerWallet.address,
          stubs.l2Token.address,
          amount
        );

      const deployer_Balance_AfterWith = await stubs.l2Token.balanceOf(
        deployerWallet.address
      );

      expect(deployer_Balance_BeforeWith.sub(deployer_Balance_AfterWith)).to.eq(
        amount,
        "Change of the recipient balance of L2 token after withdrawal must match withdraw amount"
      );

      const l2_TotalSupply_AfterFirstTx = await stubs.l2Token.totalSupply();

      deltaL2TokenSupply = l2_TotalSupply_BeforeWith.sub(
        l2_TotalSupply_AfterFirstTx
      );

      expect(deltaL2TokenSupply).to.eq(
        amount,
        "Total supply of l2Token should decrease"
      );

      await expect(
        l2Erc20Bridge.withdraw(
          deployerWallet.address,
          stubs.l2Token.address,
          amount,
          { gasLimit }
        )
      )
        .to.emit(l2Erc20Bridge, "WithdrawalInitiated")
        .withArgs(
          deployerWallet.address,
          deployerWallet.address,
          stubs.l2Token.address,
          amount
        );

      const l2_TotalSupply_AfterSecondTx = await stubs.l2Token.totalSupply();

      deltaL2TokenSupply = l2_TotalSupply_AfterFirstTx.sub(
        l2_TotalSupply_AfterSecondTx
      );

      expect(deltaL2TokenSupply).to.eq(
        amount,
        "Total supply of l2Token should decrease"
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
 * @param l2Erc20Bridge L2 ERC20 Bridge
 * @param defaultAdminAddress Address of the contract/account that admins the bridge
 * @param depositEnablerAddress Address of the contract/account that can enable deposits
 */
async function enableDepositsWithAssertions(
  l2Erc20Bridge: Contract,
  defaultAdminAddress: string,
  depositEnablerAddress: string
) {
  const isDepositsEnabled = await l2Erc20Bridge.isDepositsEnabled();

  await initializeBridgesWithAssertion(l2Erc20Bridge, defaultAdminAddress);

  if (!isDepositsEnabled) {
    // grant DEPOSITS_ENABLER_ROLE role
    await l2Erc20Bridge.grantRole(
      await l2Erc20Bridge.DEPOSITS_ENABLER_ROLE(),
      depositEnablerAddress,
      { gasLimit: 10_000_000 }
    );

    const enableTx = await l2Erc20Bridge.enableDeposits({
      gasLimit: 10_000_000,
    });
    await enableTx.wait();
  }

  assert.isTrue(await l2Erc20Bridge.isDepositsEnabled());
}

/**
 * enableWithdrawalsWithAssertions
 * @param l2Erc20Bridge L2 ERC20 Bridge
 * @param defaultAdminAddress Address of the contract/account that admins the bridge
 * @param withdrawalEnablerAddress Address of the contract/account that can enable withdrawals
 */
async function enableWithdrawalsWithAssertions(
  l2Erc20Bridge: Contract,
  defaultAdminAddress: string,
  withdrawalEnablerAddress: string
) {
  const isWithdrawalsEnabled = await l2Erc20Bridge.isWithdrawalsEnabled();

  await initializeBridgesWithAssertion(l2Erc20Bridge, defaultAdminAddress);

  if (!isWithdrawalsEnabled) {
    // grant WITHDRAWALS_ENABLER_ROLE role
    await l2Erc20Bridge.grantRole(
      await l2Erc20Bridge.WITHDRAWALS_ENABLER_ROLE(),
      withdrawalEnablerAddress,
      { gasLimit: 10_000_000 }
    );

    const enableTx = await l2Erc20Bridge.enableWithdrawals({
      gasLimit: 10_000_000,
    });
    await enableTx.wait();
  }

  assert.isTrue(await l2Erc20Bridge.isWithdrawalsEnabled());
}

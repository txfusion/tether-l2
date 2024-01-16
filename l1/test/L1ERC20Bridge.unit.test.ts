import hre, { ethers } from "hardhat";
import { assert, expect } from "chai";
import { setup } from "./setup/unit.setup";

describe("~~~~~ L1ERC20Bridge ~~~~~", async () => {
  let ctx: Awaited<ReturnType<typeof setup>>;

  beforeEach("Setting up the context", async () => {
    ctx = await setup();
  });

  describe("=== Getters ===", async () => {
    it("*** ZkSync ***", async () => {
      const { l1Erc20Bridge, stubs } = ctx;
      assert.equal(await l1Erc20Bridge.zkSync(), stubs.zkSync.address);
    });

    it("*** L1 Token ***", async () => {
      const { l1Erc20Bridge, stubs } = ctx;
      assert.equal(await l1Erc20Bridge.l1Token(), stubs.l1Token.address);
    });

    it("*** L2 Token ***", async () => {
      const { l1Erc20Bridge, stubs } = ctx;
      assert.equal(await l1Erc20Bridge.l2Token(), stubs.l2Token.address);
    });

    it("*** L2 Bridge ***", async () => {
      const { l1Erc20Bridge, stubs } = ctx;
      assert.equal(await l1Erc20Bridge.l2Bridge(), stubs.l2Erc20Bridge.address);
    });

    describe("*** L2 Token Address ***", async () => {
      it("Correct L1 Token", async () => {
        const { l1Erc20Bridge, stubs } = ctx;
        const actualL2TokenAddress = await l1Erc20Bridge.l2TokenAddress(
          stubs.l1Token.address
        );

        assert.equal(actualL2TokenAddress, stubs.l2Token.address);
      });

      it("Incorrect L1 Token", async () => {
        const { l1Erc20Bridge, accounts } = ctx;
        const actualL2TokenAddress = await l1Erc20Bridge.l2TokenAddress(
          accounts.stranger.address
        );

        assert.equal(actualL2TokenAddress, hre.ethers.constants.AddressZero);
      });
    });
  });

  describe("=== Deposit ===", async () => {
    it("Deposits enabled?", async () => {
      const { l1Erc20Bridge } = ctx;
      assert.isTrue(await l1Erc20Bridge.isDepositsEnabled());
    });

    it("> Disable deposits", async () => {
      const {
        accounts: { deployer },
        l1Erc20Bridge,
      } = ctx;

      // validate that contract is not initialized and deposits are enabled
      assert.isTrue(await l1Erc20Bridge.isInitialized());
      assert.isTrue(await l1Erc20Bridge.isDepositsEnabled());

      // grant DEPOSITS_DISABLER_ROLE role
      await l1Erc20Bridge.grantRole(
        await l1Erc20Bridge.DEPOSITS_DISABLER_ROLE(),
        deployer.address
      );

      await l1Erc20Bridge.disableDeposits();

      assert.isFalse(await l1Erc20Bridge.isDepositsEnabled());
    });

    it("Wrong L1 Token address", async () => {
      const {
        accounts: { sender, recipient, stranger: wrongL1Token },
        l1Erc20Bridge,
      } = ctx;
      const amount = ethers.utils.parseUnits("1", "ether");
      const l2TxGasLimit = ethers.utils.parseUnits("1000", "gwei");
      const l2TxGasPerPubdataByte = ethers.utils.parseUnits("800", "wei");

      await expect(
        l1Erc20Bridge[
          "deposit(address,address,uint256,uint256,uint256,address)"
        ](
          recipient.address,
          wrongL1Token.address,
          amount,
          l2TxGasLimit,
          l2TxGasPerPubdataByte,
          sender.address
        )
      ).to.be.revertedWith("ErrorUnsupportedL1Token");
    });

    it("Wrong (zero) deposit amount", async () => {
      const {
        accounts: { sender, recipient },
        l1Erc20Bridge,
      } = ctx;
      const wrongAmount = ethers.utils.parseUnits("0", "ether");
      const l2TxGasLimit = ethers.utils.parseUnits("1000", "gwei");
      const l2TxGasPerPubdataByte = ethers.utils.parseUnits("800", "wei");

      await expect(
        l1Erc20Bridge[
          "deposit(address,address,uint256,uint256,uint256,address)"
        ](
          recipient.address,
          ctx.stubs.l1Token.address,
          wrongAmount,
          l2TxGasLimit,
          l2TxGasPerPubdataByte,
          sender.address
        )
      ).to.be.revertedWith("The deposit amount can't be zero");
    });

    it("Insufficient token allowance for bridge", async () => {
      const {
        accounts: { sender, recipient },
        l1Erc20Bridge,
      } = ctx;
      const amount = ethers.utils.parseUnits("1", "ether");
      const l2TxGasLimit = ethers.utils.parseUnits("1000", "gwei");
      const l2TxGasPerPubdataByte = ethers.utils.parseUnits("800", "wei");

      await expect(
        l1Erc20Bridge[
          "deposit(address,address,uint256,uint256,uint256,address)"
        ](
          recipient.address,
          ctx.stubs.l1Token.address,
          amount,
          l2TxGasLimit,
          l2TxGasPerPubdataByte,
          sender.address
        )
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it(">>> Works as expected", async () => {
      const {
        accounts: { sender, recipient },
        stubs: { zkSync, l2Erc20Bridge, l1Token },
        l1Erc20Bridge,
      } = ctx;
      const amount = ethers.utils.parseUnits("1", "ether");
      const l2TxGasLimit = ethers.utils.parseUnits("1000", "gwei");
      const l2TxGasPerPubdataByte = ethers.utils.parseUnits("800", "wei");
      const value = ethers.utils.parseUnits("250000", "gwei");

      const senderBalanceBefore = await l1Token.balanceOf(sender.address);
      const bridgeBalanceBefore = await l1Token.balanceOf(
        l1Erc20Bridge.address
      );

      // set allowance to L1 bridge
      await l1Token.connect(sender)["approve"](l1Erc20Bridge.address, amount);

      // validate token allowance for bridge
      const l1TokenAllowance = await l1Token.allowance(
        sender.address,
        l1Erc20Bridge.address
      );

      expect(
        l1TokenAllowance.eq(amount),
        `Value ${l1TokenAllowance.toString()} is not equal to ${amount.toString()}`
      );

      // set canonicalTxHash
      const canonicalTxHash =
        ethers.utils.formatBytes32String("canonicalTxHash");
      await zkSync.setCanonicalTxHash(canonicalTxHash);

      assert.equal(await zkSync.canonicalTxHash(), canonicalTxHash);

      const depositTx = await l1Erc20Bridge
        .connect(sender)
        ["deposit(address,address,uint256,uint256,uint256,address)"](
          recipient.address,
          l1Token.address,
          amount,
          l2TxGasLimit,
          l2TxGasPerPubdataByte,
          sender.address,
          { value }
        );

      const txCalldata = l2Erc20Bridge.interface.encodeFunctionData(
        "finalizeDeposit",
        [sender.address, recipient.address, l1Token.address, amount, "0x"]
      );

      const l1BridgeDepositAmount = await l1Erc20Bridge.depositAmount(
        sender.address,
        canonicalTxHash
      );

      // validate depositAmount used to claim funds in case the deposit transaction will fail
      expect(
        l1BridgeDepositAmount.eq(amount),
        `Value ${l1BridgeDepositAmount.toString()} is not equal to ${amount.toString()}`
      );

      // validate DepositInitiated event is emitted with the expected data
      await expect(depositTx)
        .to.emit(l1Erc20Bridge, "DepositInitiated")
        .withArgs(
          canonicalTxHash,
          sender.address,
          recipient.address,
          l1Token.address,
          amount,
          sender.address
        );

      // validate RequestL2TransactionCalled event is emitted with the expected data
      await expect(depositTx)
        .to.emit(zkSync, "RequestL2TransactionCalled")
        .withArgs(
          value,
          l2Erc20Bridge.address,
          0,
          txCalldata,
          l2TxGasLimit,
          l2TxGasPerPubdataByte,
          [],
          sender.address
        );

      const senderL1TokenBalance = await l1Token.balanceOf(sender.address);
      const bridgeL1TokenBalance = await l1Token.balanceOf(
        l1Erc20Bridge.address
      );

      // validate balance of the sender decreased
      expect(
        senderL1TokenBalance.eq(senderBalanceBefore.sub(amount)),
        `Value ${senderL1TokenBalance.toString()} is not equal to ${senderBalanceBefore
          .sub(amount)
          .toString()}`
      );

      // validate balance of the L1 bridge increased
      expect(
        bridgeL1TokenBalance.eq(bridgeBalanceBefore.add(amount)),
        `Value ${bridgeL1TokenBalance.toString()} is not equal to ${bridgeBalanceBefore
          .add(amount)
          .toString()}`
      );
    });
  });

  describe("=== Finalize Withdrawal ===", async () => {
    it("Withdrawals enabled?", async () => {
      const { l1Erc20Bridge } = ctx;
      assert.isTrue(await l1Erc20Bridge.isWithdrawalsEnabled());
    });

    it("> Disable withdrawals", async () => {
      const {
        accounts: { deployer },
        l1Erc20Bridge,
      } = ctx;

      // validate that contract is not initialized and withdrawals are enabled
      assert.isTrue(await l1Erc20Bridge.isInitialized());
      assert.isTrue(await l1Erc20Bridge.isWithdrawalsEnabled());

      // grant WITHDRAWALS_DISABLER_ROLE role
      await l1Erc20Bridge.grantRole(
        await l1Erc20Bridge.WITHDRAWALS_DISABLER_ROLE(),
        deployer.address
      );

      await l1Erc20Bridge.disableWithdrawals();

      assert.isFalse(await l1Erc20Bridge.isWithdrawalsEnabled());
    });

    it("Not enough ETH locked on L1 bridge", async () => {
      const {
        accounts: { recipient },
        stubs: { l1Token },
        l1Erc20Bridge,
      } = ctx;
      const amount = ethers.utils.parseUnits("1", "ether");

      const l2BlockNumber = ethers.BigNumber.from("1");
      const l2MessageIndex = ethers.BigNumber.from("1");
      const l2TxNumberInBlock = 1;
      const merkleProof = [
        ethers.utils.formatBytes32String("proof1"),
        ethers.utils.formatBytes32String("proof2"),
      ];

      const l1Erc20BridgeInterface = l1Erc20Bridge.interface;
      const withdrawMessage = ethers.utils.solidityPack(
        ["bytes4", "address", "address", "uint256"],
        [
          l1Erc20BridgeInterface.getSighash(
            l1Erc20BridgeInterface.getFunction("finalizeWithdrawal")
          ),
          recipient.address,
          l1Token.address,
          amount,
        ]
      );

      await expect(
        l1Erc20Bridge.finalizeWithdrawal(
          l2BlockNumber,
          l2MessageIndex,
          l2TxNumberInBlock,
          withdrawMessage,
          merkleProof
        )
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it(">>> Works as expected (called by stranger)", async () => {
      const {
        accounts: { recipient, stranger },
        stubs: { l1Token },
        l1Erc20Bridge,
      } = ctx;

      const amount = ethers.utils.parseUnits("1", "ether");

      const recipientBalanceBefore = await l1Token.balanceOf(recipient.address);
      // transfer tokens to L1 bridge to simulate locked funds
      await l1Token.transfer(l1Erc20Bridge.address, amount);
      const bridgeBalanceBefore = await l1Token.balanceOf(
        l1Erc20Bridge.address
      );

      const l2BlockNumber = ethers.BigNumber.from("1");
      const l2MessageIndex = ethers.BigNumber.from("1");
      const l2TxNumberInBlock = 1;
      const merkleProof = [
        ethers.utils.formatBytes32String("proof1"),
        ethers.utils.formatBytes32String("proof2"),
      ];

      const l1Erc20BridgeInterface = l1Erc20Bridge.interface;
      const withdrawMessage = ethers.utils.solidityPack(
        ["bytes4", "address", "address", "uint256"],
        [
          l1Erc20BridgeInterface.getSighash(
            l1Erc20BridgeInterface.getFunction("finalizeWithdrawal")
          ),
          recipient.address,
          l1Token.address,
          amount,
        ]
      );

      const finalizeWithdrawalTx = await l1Erc20Bridge
        .connect(stranger)
        .finalizeWithdrawal(
          l2BlockNumber,
          l2MessageIndex,
          l2TxNumberInBlock,
          withdrawMessage,
          merkleProof
        );

      // validate withdrawal marked as finalized
      assert.isTrue(
        await l1Erc20Bridge.isWithdrawalFinalized(l2BlockNumber, l2MessageIndex)
      );

      // validate WithdrawalFinalized event is emitted with the expected data
      await expect(finalizeWithdrawalTx)
        .to.emit(l1Erc20Bridge, "WithdrawalFinalized")
        .withArgs(recipient.address, l1Token.address, amount);

      const recipientL1TokenBalance = await l1Token.balanceOf(
        recipient.address
      );
      const bridgeL1TokenBalance = await l1Token.balanceOf(
        l1Erc20Bridge.address
      );

      // validate balance of the recipient increased
      expect(
        recipientL1TokenBalance.eq(recipientBalanceBefore.add(amount)),
        `Value ${recipientL1TokenBalance.toString()} is not equal to ${recipientBalanceBefore
          .add(amount)
          .toString()}`
      );

      expect(
        bridgeL1TokenBalance.eq(bridgeBalanceBefore.sub(amount)),
        `Value ${bridgeL1TokenBalance.toString()} is not equal to ${bridgeBalanceBefore
          .sub(amount)
          .toString()}`
      );
    });
  });

  describe("=== Claim Failed Deposits ===", async () => {
    it("Nothing to claim", async () => {
      const {
        accounts: { sender },
        stubs: { l1Token },
        l1Erc20Bridge,
      } = ctx;

      const txHash = ethers.utils.formatBytes32String("txHash");
      const l2BlockNumber = ethers.BigNumber.from("1");
      const l2MessageIndex = ethers.BigNumber.from("1");
      const l2TxNumberInBlock = 1;
      const merkleProof = [
        ethers.utils.formatBytes32String("proof1"),
        ethers.utils.formatBytes32String("proof2"),
      ];

      await expect(
        l1Erc20Bridge.claimFailedDeposit(
          sender.address,
          l1Token.address,
          txHash,
          l2BlockNumber,
          l2MessageIndex,
          l2TxNumberInBlock,
          merkleProof
        )
      ).to.be.revertedWith("The claimed amount can't be zero");
    });

    it("Works us expected", async () => {
      const {
        accounts: { sender, recipient },
        stubs: { zkSync, l1Token },
        l1Erc20Bridge,
      } = ctx;
      const amount = ethers.utils.parseUnits("1", "ether");
      const l2TxGasLimit = ethers.utils.parseUnits("1000", "gwei");
      const l2TxGasPerPubdataByte = ethers.utils.parseUnits("800", "wei");
      const value = ethers.utils.parseUnits("250000", "gwei");

      await l1Token.connect(sender)["approve"](l1Erc20Bridge.address, amount);

      const canonicalTxHash =
        ethers.utils.formatBytes32String("canonicalTxHash");
      await zkSync.setCanonicalTxHash(canonicalTxHash);

      const l2BlockNumber = ethers.BigNumber.from("1");
      const l2MessageIndex = ethers.BigNumber.from("1");
      const l2TxNumberInBlock = 1;
      const merkleProof = [
        ethers.utils.formatBytes32String("proof1"),
        ethers.utils.formatBytes32String("proof2"),
      ];

      const senderBalanceBeforeDeposit = await l1Token.balanceOf(
        sender.address
      );
      const bridgeBalanceBeforeDeposit = await l1Token.balanceOf(
        l1Erc20Bridge.address
      );

      const depositTx = await l1Erc20Bridge
        .connect(sender)
        ["deposit(address,address,uint256,uint256,uint256,address)"](
          recipient.address,
          l1Token.address,
          amount,
          l2TxGasLimit,
          l2TxGasPerPubdataByte,
          sender.address,
          { value }
        );
      await depositTx.wait();

      const senderBalanceAfterDeposit = await l1Token.balanceOf(sender.address);
      const bridgeBalanceAfterDeposit = await l1Token.balanceOf(
        l1Erc20Bridge.address
      );

      // validate balance of the sender decreased after deposit
      expect(
        senderBalanceAfterDeposit.eq(senderBalanceBeforeDeposit.sub(amount)),
        `Value ${senderBalanceAfterDeposit.toString()} is not equal to ${senderBalanceBeforeDeposit
          .sub(amount)
          .toString()}`
      );

      // validate balance of the bridge increased after deposit
      expect(
        bridgeBalanceAfterDeposit.eq(bridgeBalanceBeforeDeposit.add(amount)),
        `Value ${bridgeBalanceAfterDeposit.toString()} is not equal to ${bridgeBalanceBeforeDeposit
          .add(amount)
          .toString()}`
      );

      const claimFailedDepositTx = await l1Erc20Bridge.claimFailedDeposit(
        sender.address,
        l1Token.address,
        canonicalTxHash,
        l2BlockNumber,
        l2MessageIndex,
        l2TxNumberInBlock,
        merkleProof
      );

      await expect(claimFailedDepositTx)
        .to.emit(l1Erc20Bridge, "ClaimedFailedDeposit")
        .withArgs(sender.address, l1Token.address, amount);

      const senderBalanceAfterClaimFailedDeposit = await l1Token.balanceOf(
        sender.address
      );
      const bridgeBalanceAfterClaimFailedDeposit = await l1Token.balanceOf(
        l1Erc20Bridge.address
      );

      // validate balance of the sender increased after claiming failed deposit
      expect(
        senderBalanceAfterClaimFailedDeposit.eq(
          senderBalanceAfterDeposit.add(amount)
        ),
        `Value ${senderBalanceAfterClaimFailedDeposit.toString()} is not equal to ${senderBalanceAfterDeposit
          .add(amount)
          .toString()}`
      );

      // validate balance of the bridge decreased after claiming failed deposit
      expect(
        bridgeBalanceAfterClaimFailedDeposit.eq(
          bridgeBalanceAfterDeposit.sub(amount)
        ),
        `Value ${bridgeBalanceAfterClaimFailedDeposit.toString()} is not equal to ${bridgeBalanceAfterDeposit
          .sub(amount)
          .toString()}`
      );
    });
  });
});

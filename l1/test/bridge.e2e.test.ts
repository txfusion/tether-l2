import { describe } from "mocha";
import { assert, expect } from "chai";

import { setup } from "./setup/bridge.setup";
import { CHAIN_ID, TETHER_CONSTANTS } from "../../common-utils";
import { ethers } from "hardhat";

describe("~~~ Bridge E2E testing", async () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  let withdrawTxHash: string;

  before("Setting up the context", async () => {
    ctx = await setup();
  });

  describe("=== Setup ===", async () => {
    it("L1 & L2 Bridges are initiated properly", async () => {
      const {
        l1: { l1Bridge, l1Token },
        l2: { l2Bridge, l2Token },
      } = ctx;

      assert(
        (await l1Bridge.l1Token()).toUpperCase() ===
          l1Token.address.toUpperCase()
      );
      assert(
        (await l1Bridge.l2BridgeAddress(CHAIN_ID)).toUpperCase() ===
          l2Bridge.address.toUpperCase()
      );
      assert.isTrue(await l1Bridge.isInitialized());

      assert(
        (await l2Bridge.l1Token()).toUpperCase() ===
          l1Token.address.toUpperCase()
      );
      assert(
        (await l2Bridge.l2Token()).toUpperCase() ===
          l2Token.address.toUpperCase()
      );
      assert(
        (await l2Bridge.l1Bridge()).toUpperCase() ===
          l1Bridge.address.toUpperCase()
      );
      assert.isTrue(await l2Bridge.isInitialized());
    });

    it("Tester has required amount of L1 token", async () => {
      const {
        l1: {
          l1Token,
          accounts: { deployer },
        },
        depositAmount,
      } = ctx;

      const walletAddress = deployer.address;

      const l1Token_UserBalance_Before = await l1Token.balanceOf(walletAddress);

      if (l1Token_UserBalance_Before.lt(depositAmount)) {
        const tokenMintResponse = await l1Token.mint(
          walletAddress,
          depositAmount
        );
        await tokenMintResponse.wait();
      }
      const l1Token_UserBalance_After = await l1Token.balanceOf(walletAddress);

      assert(l1Token_UserBalance_After.gte(depositAmount));
    });
  });

  describe("=== Deposit + Withdraw ===", async () => {
    it("> Set allowance for L1ERC20Bridge to deposit", async () => {
      const {
        l1: {
          l1Token,
          l1Bridge,
          accounts: { deployer },
        },
        depositAmount,
      } = ctx;

      const allowanceTxResponse = await l1Token.approve(
        l1Bridge.address,
        depositAmount
      );

      await allowanceTxResponse.wait();

      const l1BridgeAllowance_After = await l1Token.allowance(
        deployer.address,
        l1Bridge.address
      );

      expect(
        l1BridgeAllowance_After.eq(depositAmount),
        `Value ${l1BridgeAllowance_After.toString()} is not equal to ${depositAmount.toString()}`
      );
    });

    it("> Deposit funds onto L1ERC20Bridge", async () => {
      const {
        l1: { l1Token, l1Bridge, accounts },
        l2: {
          l2Token,
          l2Bridge,
          accounts: { deployer },
        },
        zkProvider,
        depositAmount,
        ADDRESSES,
      } = ctx;

      const walletAddress = accounts.deployer.address;

      assert.isTrue(
        await l1Bridge.isDepositsEnabled(),
        "L1 Deposits should be enabled"
      );
      assert.isTrue(
        await l2Bridge.isDepositsEnabled(),
        "L2 Deposits should be enabled"
      );

      /**
       * Befores
       */
      const l2Token_TotalSupply_Before = await l2Token.totalSupply();
      const l1ERC20Bridge_TokenBalance_Before = await l1Token.balanceOf(
        l1Bridge.address
      );
      const userL1_TokenBalance_Before = await l1Token.balanceOf(walletAddress);
      const userL2_TokenBalance_Before = await l2Token.balanceOf(walletAddress);

      const coder = new ethers.utils.AbiCoder();
      const depositTx = await deployer.deposit({
        token: l1Token.address,
        amount: depositAmount,
        bridgeAddress: ADDRESSES.Bridges.L1SharedBridgeProxy,
        customBridgeData: coder.encode(
          ["bytes", "bytes", "bytes"],
          [
            coder.encode(["string"], [TETHER_CONSTANTS.NAME]),
            coder.encode(["string"], [TETHER_CONSTANTS.SYMBOL]),
            coder.encode(["uint256"], [TETHER_CONSTANTS.DECIMALS]), // TODO: Either 6 decimals for the real L2 token or 18 decimals for mock L1 token
          ]
        ),
      });
      await depositTx.waitFinalize();

      // TODO: Check if needed
      const l2Response = await zkProvider.getL2TransactionFromPriorityOp(
        depositTx
      );
      await l2Response.wait();

      /**
       * Afters
       */
      const l2Token_TotalSupply_After = await l2Token.totalSupply();
      const l1ERC20Bridge_TokenBalance_After = await l1Token.balanceOf(
        l1Bridge.address
      );
      const userL1_TokenBalance_After = await l1Token.balanceOf(walletAddress);
      const userL2_TokenBalance_After = await l2Token.balanceOf(walletAddress);

      /**
       * Diffs
       */
      const l1Token_TotalSupply_Difference =
        l1ERC20Bridge_TokenBalance_After.sub(l1ERC20Bridge_TokenBalance_Before);
      const l2Token_TotalSupply_Difference = l2Token_TotalSupply_After.sub(
        l2Token_TotalSupply_Before
      );
      const l1Token_UserBalance_Difference = userL1_TokenBalance_Before.sub(
        userL1_TokenBalance_After
      );
      const l2Token_UserBalance_Difference = userL2_TokenBalance_After.sub(
        userL2_TokenBalance_Before
      );

      // total supply of L2 token should increase
      expect(
        l2Token_TotalSupply_Difference.eq(depositAmount),
        `Value ${l2Token_TotalSupply_Difference.toString()} is not equal to ${depositAmount.toString()}`
      );

      // L1 token balance owned by bridge should increase
      expect(
        l1Token_TotalSupply_Difference.eq(depositAmount),
        `Value ${l1Token_TotalSupply_Difference.toString()} is not equal to ${depositAmount.toString()}`
      );

      // L1 token balance owned by user should decrease
      expect(
        l1Token_UserBalance_Difference.eq(depositAmount),
        `Value ${l1Token_TotalSupply_Difference.toString()} is not equal to ${depositAmount.toString()}`
      );

      // L2 token balance owned by user should increase
      expect(
        l2Token_UserBalance_Difference.eq(depositAmount),
        `Value ${l1Token_TotalSupply_Difference.toString()} is not equal to ${depositAmount.toString()}`
      );
    });

    it("> Withdraw tokens from L2 via L2ERC20Bridge", async () => {
      const {
        l1: { l1Token, l1Bridge },
        l2: {
          l2Token,
          l2Bridge,
          accounts: { deployer },
        },
        withdrawalAmount,
        ADDRESSES,
      } = ctx;

      const walletAddress = deployer.address;

      assert.isTrue(
        await l1Bridge.isWithdrawalsEnabled(),
        "L1 Withdrawals should be enabled"
      );

      assert.isTrue(
        await l2Bridge.isWithdrawalsEnabled(),
        "L2 Withdrawals should be enabled"
      );

      const l1ERC20Bridge_TokenBalance_Before = await l1Token.balanceOf(
        l1Bridge.address
      );
      const l2Token_TotalSupply_Before = await l2Token.totalSupply();
      const userL1_TokenBalance_Before = await l1Token.balanceOf(walletAddress);
      const userL2_TokenBalance_Before = await l2Token.balanceOf(walletAddress);

      // Execute withdraw
      const withdrawTx = await deployer.withdraw({
        token: l2Token.address,
        amount: withdrawalAmount,
        bridgeAddress: ADDRESSES.Bridges.L2SharedBridgeProxy,
      });
      await withdrawTx.waitFinalize();

      await (await deployer.finalizeWithdrawal(withdrawTx.hash)).wait();

      withdrawTxHash = withdrawTx.hash;

      const finalizeWithdrawalResponse = await deployer.finalizeWithdrawal(
        withdrawTxHash
      );
      await finalizeWithdrawalResponse.wait();

      // Checks
      const l2Token_TotalSupply_After = await l2Token.totalSupply();
      const l1ERC20Bridge_TokenBalance_After = await l1Token.balanceOf(
        l1Bridge.address
      );
      const userL1_TokenBalance_After = await l1Token.balanceOf(walletAddress);
      const userL2_TokenBalance_After = await l2Token.balanceOf(walletAddress);

      const l1Token_TotalSupply_Difference = l2Token_TotalSupply_Before.sub(
        l2Token_TotalSupply_After
      );
      const l1ERC20Bridge_TokenBalance_Difference =
        l1ERC20Bridge_TokenBalance_Before.sub(l1ERC20Bridge_TokenBalance_After);
      const l1Token_UserBalance_Difference = userL1_TokenBalance_After.sub(
        userL1_TokenBalance_Before
      );
      const l2Token_UserBalance_Difference = userL2_TokenBalance_Before.sub(
        userL2_TokenBalance_After
      );

      // total supply of L2 token should decrease
      expect(
        l1Token_TotalSupply_Difference.eq(withdrawalAmount),
        `Value ${l1Token_TotalSupply_Difference.toString()} is not equal to ${withdrawalAmount.toString()}`
      );

      // L1 token balance owned by bridge should decrease
      expect(
        l1ERC20Bridge_TokenBalance_Difference.eq(withdrawalAmount),
        `Value ${l1ERC20Bridge_TokenBalance_Difference.toString()} is not equal to ${withdrawalAmount.toString()}`
      );

      // L1 token balance owned by user should increase
      expect(
        l1Token_UserBalance_Difference.eq(withdrawalAmount),
        `Value ${l1Token_UserBalance_Difference.toString()} is not equal to ${withdrawalAmount.toString()}`
      );

      // L2 token balance owned by user should decrease
      expect(
        l2Token_UserBalance_Difference.eq(withdrawalAmount),
        `Value ${l2Token_UserBalance_Difference.toString()} is not equal to ${withdrawalAmount.toString()}`
      );
    });

    it.only("> Prevents finalization of an already finalized withdrawal", async () => {
      const {
        l2: {
          accounts: { deployer },
        },
      } = ctx;

      assert.isTrue(
        await deployer.isWithdrawalFinalized(withdrawTxHash),
        "Withdrawal isn't finalized"
      );

      await expect(
        deployer.finalizeWithdrawal(withdrawTxHash)
      ).to.be.revertedWith("Withdrawal is already finalized");
    });
  });
});

import hre, { ethers } from "hardhat";
import { assert, expect } from "chai";
import { setup } from "./setup/unit.setup";
import { CHAIN_ID, TETHER_CONSTANTS } from "../../common-utils";
import { Wallet } from "zksync-ethers";
import { BigNumber } from "ethers";

describe("~~~~~ l1SharedBridge ~~~~~", async () => {
  let ctx: Awaited<ReturnType<typeof setup>>;

  beforeEach("Setting up the context", async () => {
    ctx = await setup();
  });

  describe("=== Getters ===", async () => {
    it("*** ZkSync ***", async () => {
      const { l1SharedBridge, ADDRESSES } = ctx;
      assert.equal(
        await l1SharedBridge.BRIDGE_HUB(),
        ADDRESSES.Bridgehub.Proxy
      );
    });

    it("*** L1 Token ***", async () => {
      const { l1SharedBridge, stubs } = ctx;
      assert.equal(await l1SharedBridge.l1Token(), stubs.l1Token.address);
    });

    it("*** L2 Bridge ***", async () => {
      const { l1SharedBridge, stubs } = ctx;
      assert.equal(
        await l1SharedBridge.l2BridgeAddress(CHAIN_ID),
        stubs.l2Erc20Bridge.address
      );
    });
  });

  describe("=== Deposit ===", async () => {
    it("Deposits enabled?", async () => {
      const { l1SharedBridge } = ctx;
      assert.isTrue(await l1SharedBridge.isDepositsEnabled());
    });

    it("> Disable deposits", async () => {
      const {
        accounts: { deployer },
        l1SharedBridge,
      } = ctx;

      // validate that contract is not initialized and deposits are enabled
      assert.isTrue(await l1SharedBridge.isInitialized());
      assert.isTrue(await l1SharedBridge.isDepositsEnabled());

      // grant DEPOSITS_DISABLER_ROLE role
      await l1SharedBridge.grantRole(
        await l1SharedBridge.DEPOSITS_DISABLER_ROLE(),
        deployer.address
      );

      await l1SharedBridge.disableDeposits();

      assert.isFalse(await l1SharedBridge.isDepositsEnabled());
    });

    it("Wrong L1 Token address", async () => {
      const {
        accounts: { deployer, stranger: wrongL1Token },
        l1SharedBridge,
      } = ctx;

      await deposit(
        deployer,
        wrongL1Token.address,
        ethers.utils.parseUnits("1", "ether"),
        l1SharedBridge.address,
        "BridgeableTokensUpgradable__ErrorUnsupportedL1Token"
      );
    });

    it("Wrong (zero) deposit amount", async () => {
      const {
        accounts: { deployer },
        l1SharedBridge,
      } = ctx;

      await deposit(
        deployer,
        ctx.stubs.l1Token.address,
        ethers.utils.parseUnits("0", "ether"),
        l1SharedBridge.address,
        "6T" // empty deposit error
      );
    });

    it("Insufficient token allowance for bridge", async () => {
      const {
        accounts: { deployer },
        l1SharedBridge,
      } = ctx;

      await deposit(
        deployer,
        ctx.stubs.l1Token.address,
        ethers.utils.parseUnits("1", "ether"),
        l1SharedBridge.address,
        "ERC20: insufficient allowance"
      );
    });

    it(">>> Works as expected", async () => {
      const {
        accounts: { deployer },
        stubs: { l2Erc20Bridge, l1Token },
        l1SharedBridge,
      } = ctx;
      const amount = ethers.utils.parseUnits("1", "ether");
      const l2TxGasLimit = ethers.utils.parseUnits("1000", "gwei");
      const l2TxGasPerPubdataByte = ethers.utils.parseUnits("800", "wei");
      const value = ethers.utils.parseUnits("250000", "gwei");

      const senderBalanceBefore = await l1Token.balanceOf(deployer.address);
      const bridgeBalanceBefore = await l1Token.balanceOf(
        l1SharedBridge.address
      );

      // set allowance to L1 bridge
      await l1Token
        .connect(deployer)
        ["approve"](l1SharedBridge.address, amount);

      // validate token allowance for bridge
      const l1TokenAllowance = await l1Token.allowance(
        deployer.address,
        l1SharedBridge.address
      );

      expect(
        l1TokenAllowance.eq(amount),
        `Value ${l1TokenAllowance.toString()} is not equal to ${amount.toString()}`
      );

      await deposit(
        deployer,
        ctx.stubs.l1Token.address,
        amount,
        l1SharedBridge.address
      );

      const senderL1TokenBalance = await l1Token.balanceOf(deployer.address);
      const bridgeL1TokenBalance = await l1Token.balanceOf(
        l1SharedBridge.address
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
      const { l1SharedBridge } = ctx;
      assert.isTrue(await l1SharedBridge.isWithdrawalsEnabled());
    });

    it("> Disable withdrawals", async () => {
      const {
        accounts: { deployer },
        l1SharedBridge,
      } = ctx;

      // validate that contract is not initialized and withdrawals are enabled
      assert.isTrue(await l1SharedBridge.isInitialized());
      assert.isTrue(await l1SharedBridge.isWithdrawalsEnabled());

      // grant WITHDRAWALS_DISABLER_ROLE role
      await l1SharedBridge.grantRole(
        await l1SharedBridge.WITHDRAWALS_DISABLER_ROLE(),
        deployer.address
      );

      await l1SharedBridge.disableWithdrawals();

      assert.isFalse(await l1SharedBridge.isWithdrawalsEnabled());
    });

    it(">>> Works as expected", async () => {
      const {
        accounts: { deployer },
        stubs: { l1Token },
        l1SharedBridge,
      } = ctx;

      const amount = ethers.utils.parseUnits("1", "ether");

      const recipientBalanceBefore = await l1Token.balanceOf(deployer.address);
      // transfer tokens to L1 bridge to simulate locked funds
      await l1Token.transfer(l1SharedBridge.address, amount);
      const bridgeBalanceBefore = await l1Token.balanceOf(
        l1SharedBridge.address
      );

      const txHash = await withdraw(
        deployer,
        l1Token.address,
        amount,
        l1SharedBridge.address
      );

      // validate withdrawal marked as finalized
      assert.isTrue(await deployer.isWithdrawalFinalized(txHash));

      const recipientL1TokenBalance = await l1Token.balanceOf(deployer.address);
      const bridgeL1TokenBalance = await l1Token.balanceOf(
        l1SharedBridge.address
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
});

const deposit = async (
  wallet: Wallet,
  l1TokenAddress: string,
  amount: BigNumber,
  bridgeAddress: string,
  errorMsg?: string
) => {
  const coder = new ethers.utils.AbiCoder();

  const req = {
    token: l1TokenAddress,
    amount,
    bridgeAddress,
    customBridgeData: coder.encode(
      ["bytes", "bytes", "bytes"],
      [
        coder.encode(["string"], [TETHER_CONSTANTS.NAME]),
        coder.encode(["string"], [TETHER_CONSTANTS.SYMBOL]),
        coder.encode(["uint256"], [TETHER_CONSTANTS.DECIMALS]), // TODO: Either 6 decimals for the real L2 token or 18 decimals for mock L1 token
      ]
    ),
  };

  if (errorMsg) {
    await expect(wallet.deposit(req)).to.be.revertedWith(errorMsg);
    return;
  }

  const depositTx = await wallet.deposit(req);
  await depositTx.waitFinalize();
};

const claimFailedDeposit = async (
  wallet: Wallet,
  hash: string,
  errorMsg?: string
) => {
  if (errorMsg) {
    await expect(wallet.claimFailedDeposit(hash)).to.be.revertedWith(errorMsg);
    return;
  }

  const claimTx = await wallet.claimFailedDeposit(hash);
  await claimTx.wait();
};

const withdraw = async (
  wallet: Wallet,
  l1TokenAddress: string,
  amount: BigNumber,
  bridgeAddress: string,
  errorMsg?: string
): Promise<string> => {
  const req = {
    token: l1TokenAddress,
    amount,
    bridgeAddress,
  };

  if (errorMsg) {
    await expect(wallet.withdraw(req)).to.be.revertedWith(errorMsg);
    return "";
  }

  const withdrawTx = await wallet.withdraw(req);
  await withdrawTx.waitFinalize();

  await (await wallet.finalizeWithdrawal(withdrawTx.hash)).wait();

  return withdrawTx.hash;
};

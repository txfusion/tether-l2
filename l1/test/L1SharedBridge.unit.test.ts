import { ethers } from "hardhat";
import { assert, expect } from "chai";
import { Wallet } from "zksync-ethers";
import { BigNumber } from "ethers";

import { setup } from "./setup/unit.setup";

import { CHAIN_ID } from "../../common-utils";

describe("~~~~~ L1 Shared Bridge ~~~~~", async () => {
  let ctx: Awaited<ReturnType<typeof setup>>;

  beforeEach("Setting up the context", async () => {
    ctx = await setup();
  });

  describe("=== Getters ===", async () => {
    it("*** Bridgehub ***", async () => {
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
        (await l1SharedBridge.l2BridgeAddress(CHAIN_ID)).toUpperCase(),
        stubs.l2SharedBridge.address.toUpperCase()
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

      assert.isTrue(await l1SharedBridge.isDepositsEnabled());

      // grant DEPOSITS_DISABLER_ROLE role, just in case he doesn't have it
      await l1SharedBridge.grantRole(
        await l1SharedBridge.DEPOSITS_DISABLER_ROLE(),
        deployer.address
      );

      await (await l1SharedBridge.disableDeposits()).wait(1);

      assert.isFalse(await l1SharedBridge.isDepositsEnabled());
    });

    it("Wrong L1 Token address", async () => {
      const {
        accounts: { deployer, stranger: wrongL1Token },
        l1SharedBridge,
        AMOUNT,
      } = ctx;

      await expect(
        deployer.deposit({
          token: wrongL1Token.address,
          amount: AMOUNT,
          bridgeAddress: l1SharedBridge.address,
        })
      ).to.be.reverted;
    });

    it("Wrong (zero) deposit amount", async () => {
      const {
        accounts: { deployer, stranger },
        stubs: { l1Token },
        l1SharedBridge,
      } = ctx;

      await expect(
        deployer.deposit({
          token: l1Token.address,
          amount: 0,
          bridgeAddress: l1SharedBridge.address,
        })
      ).to.be.reverted; // should be "6T"
    });

    it("Insufficient token allowance for bridge", async () => {
      const {
        accounts: { deployer },
        stubs: { l1Token },
        l1SharedBridge,
        AMOUNT,
      } = ctx;

      await l1Token.approve(l1SharedBridge.address, 0);

      await expect(
        deployer.deposit({
          token: l1Token.address,
          amount: AMOUNT,
          bridgeAddress: l1SharedBridge.address,
        })
      ).to.be.reverted; // should be "ERC20: insufficient allowance"
    });

    it(">>> Works as expected", async () => {
      const {
        accounts: { deployer },
        stubs: { l1Token },
        l1SharedBridge,
        AMOUNT,
      } = ctx;

      const senderBalanceBefore = await l1Token.balanceOf(deployer.address);
      const bridgeBalanceBefore = await l1Token.balanceOf(
        l1SharedBridge.address
      );

      await deposit(
        deployer,
        ctx.stubs.l1Token.address,
        AMOUNT,
        l1SharedBridge.address
      );

      const senderL1TokenBalance = await l1Token.balanceOf(deployer.address);
      const bridgeL1TokenBalance = await l1Token.balanceOf(
        l1SharedBridge.address
      );

      // validate balance of the sender decreased
      expect(
        senderL1TokenBalance.eq(senderBalanceBefore.sub(AMOUNT)),
        `Value ${senderL1TokenBalance.toString()} is not equal to ${senderBalanceBefore
          .sub(AMOUNT)
          .toString()}`
      );

      // validate balance of the L1 bridge increased
      expect(
        bridgeL1TokenBalance.eq(bridgeBalanceBefore.add(AMOUNT)),
        `Value ${bridgeL1TokenBalance.toString()} is not equal to ${bridgeBalanceBefore
          .add(AMOUNT)
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
      const { l1SharedBridge } = ctx;

      assert.isTrue(await l1SharedBridge.isWithdrawalsEnabled());
      await (await l1SharedBridge.disableWithdrawals()).wait(1);
      assert.isFalse(await l1SharedBridge.isWithdrawalsEnabled());
    });

    it("should revert if the L1 token is not correct", async () => {
      const {
        accounts: { deployer, stranger },
        l1SharedBridge,
      } = ctx;

      const l2ToL1message = ethers.utils.hexConcat([
        "0x11a2ccc1",
        deployer.address,
        stranger.address,
        ethers.constants.HashZero,
      ]);

      expect(
        await l1SharedBridge
          .connect(deployer)
          .finalizeWithdrawal(
            CHAIN_ID,
            0,
            0,
            0,
            l2ToL1message,
            Array(9).fill(ethers.constants.HashZero)
          )
      ).to.be.revertedWith("ShB unsupported L1 token");
    });

    it("should revert if the proof cannot be found", async () => {
      const {
        accounts: { deployer },
        stubs: { l1Token },
        l1SharedBridge,
      } = ctx;

      const l2ToL1message = ethers.utils.hexConcat([
        "0x11a2ccc1",
        deployer.address,
        l1Token.address,
        ethers.constants.HashZero,
      ]);

      expect(
        await l1SharedBridge
          .connect(deployer)
          .finalizeWithdrawal(
            CHAIN_ID,
            0,
            0,
            0,
            l2ToL1message,
            Array(9).fill(ethers.constants.HashZero)
          )
      ).to.be.revertedWith("ShB withd w proof");
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
  const req = {
    token: l1TokenAddress,
    amount,
    bridgeAddress,
    approveERC20: true,
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
  l2TokenAddress: string,
  amount: BigNumber,
  bridgeAddress: string,
  errorMsg?: string
): Promise<string> => {
  const req = {
    token: l2TokenAddress,
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

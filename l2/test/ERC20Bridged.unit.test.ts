import { assert, expect } from "chai";
import { BigNumber, ethers } from "ethers";
import { describe } from "mocha";
import { Wallet } from "zksync-web3";
import { setup } from "./utils/erc20.setup";
import {
  CHAIN_ID,
  L2_TOKEN_NAME,
  L2_TOKEN_SINGING_DOMAIN_VERSION,
} from "./utils/constants";
import { domainSeparator } from "./utils/eip712";

const types: Record<string, ethers.TypedDataField[]> = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

describe("~~~~~ ERC20Bridged ~~~~~", async () => {
  let context: Awaited<ReturnType<typeof setup>>;

  before("Setting up the context", async () => {
    context = await setup();
  });

  describe("=== Freeze ===", async () => {
    const AMOUNT = 1;

    it("non-admins cannot freeze", async () => {
      const {
        accounts: { initialHolder, governor },
        erc20Bridged,
        roles: { ADDRESS_FREEZER_ROLE },
      } = context;

      await expect(
        erc20Bridged.connect(initialHolder).freezeAddress(governor.address)
      ).to.be.revertedWith(
        `AccessControl: account ${initialHolder.address.toLowerCase()} is missing role ${ADDRESS_FREEZER_ROLE}`
      );
    });

    it("admins can freeze", async () => {
      const {
        accounts: { initialHolder, governor },
        erc20Bridged,
      } = context;

      await freezeAddress(erc20Bridged, governor, initialHolder);
    });

    describe("*** Transfer ***", async () => {
      it("frozen address cannot use transfer()", async () => {
        const {
          accounts: { initialHolder, governor },
          erc20Bridged,
        } = context;

        await freezeAddress(erc20Bridged, governor, initialHolder);

        await expect(
          erc20Bridged.connect(initialHolder).transfer(governor.address, AMOUNT)
        ).to.be.revertedWithCustomError(erc20Bridged, "OnlyNotFrozenAddress");
      });

      it("unfrozen address cannot use transfer() to frozen address", async () => {
        const {
          accounts: { initialHolder, spender, governor },
          erc20Bridged,
        } = context;

        await unfreezeAddress(erc20Bridged, governor, initialHolder);
        await freezeAddress(erc20Bridged, governor, spender);

        await expect(
          erc20Bridged.connect(initialHolder).transfer(spender.address, AMOUNT)
        ).to.be.revertedWithCustomError(erc20Bridged, "OnlyNotFrozenAddress");
      });

      it("unfrozen address can use transfer() to unfrozen address", async () => {
        const {
          accounts: { initialHolder, governor },
          erc20Bridged,
        } = context;

        await unfreezeAddress(erc20Bridged, governor, initialHolder);

        const transferTx = await erc20Bridged
          .connect(initialHolder)
          .transfer(governor.address, AMOUNT);
        await transferTx.wait();

        expect(await erc20Bridged.balanceOf(governor.address)).to.be.equal(
          AMOUNT
        );
      });
    });

    describe("*** Transfer From ***", async () => {
      it("frozen address cannot use transferFrom()", async () => {
        const {
          accounts: { initialHolder, governor },
          erc20Bridged,
        } = context;

        await freezeAddress(erc20Bridged, governor, initialHolder);

        await expect(
          erc20Bridged
            .connect(initialHolder)
            .transferFrom(initialHolder.address, governor.address, AMOUNT)
        ).to.be.revertedWithCustomError(erc20Bridged, "OnlyNotFrozenAddress");
      });

      it("unfrozen address cannot use transferFrom() to frozen address", async () => {
        const {
          accounts: { initialHolder, spender, governor },
          erc20Bridged,
        } = context;

        await unfreezeAddress(erc20Bridged, governor, initialHolder);
        await freezeAddress(erc20Bridged, governor, spender);

        const allowTx = await erc20Bridged
          .connect(initialHolder)
          .increaseAllowance(governor.address, AMOUNT);
        await allowTx.wait();

        await expect(
          erc20Bridged
            .connect(governor)
            .transferFrom(initialHolder.address, spender.address, AMOUNT)
        ).to.be.revertedWithCustomError(erc20Bridged, "OnlyNotFrozenAddress");
      });

      it("unfrozen address can use transferFrom() to unfrozen address", async () => {
        const {
          accounts: { initialHolder, governor },
          erc20Bridged,
        } = context;

        await unfreezeAddress(erc20Bridged, governor, initialHolder);

        const allowTx = await erc20Bridged
          .connect(initialHolder)
          .increaseAllowance(governor.address, AMOUNT);
        await allowTx.wait();

        const transferTx = await erc20Bridged
          .connect(governor)
          .transferFrom(initialHolder.address, governor.address, AMOUNT);
        await transferTx.wait();

        expect(await erc20Bridged.balanceOf(governor.address)).to.be.equal(
          AMOUNT * 2
        ); // AMOUNT * 2 because of the previous "transfer" test
      });
    });
  });

  describe("=== Burn ===", async () => {
    it("non-admins cannot burn", async () => {
      const {
        accounts: { initialHolder, governor },
        erc20Bridged,
        roles: { ADDRESS_BURNER_ROLE },
      } = context;

      await expect(
        erc20Bridged.connect(initialHolder).burnFrozenTokens(governor.address)
      ).to.be.revertedWith(
        `AccessControl: account ${initialHolder.address.toLowerCase()} is missing role ${ADDRESS_BURNER_ROLE}`
      );
    });

    it("admins cannot burn unfrozen accounts", async () => {
      const {
        accounts: { initialHolder, governor },
        erc20Bridged,
      } = context;

      await freezeAddress(erc20Bridged, governor, initialHolder);

      expect(
        await erc20Bridged
          .connect(governor)
          .burnFrozenTokens(initialHolder.address)
      ).to.be.revertedWithCustomError(erc20Bridged, "OnlyFrozenAddress");
    });

    it("admins can burn frozen accounts", async () => {
      const {
        accounts: { initialHolder, governor },
        erc20Bridged,
      } = context;

      await freezeAndBurn(erc20Bridged, governor, initialHolder);
    });
  });

  describe("=== Getters ===", async () => {
    it("nonces() - initial nonce is 0", async () => {
      const {
        accounts: { initialHolder },
        erc20Bridged,
      } = context;
      assert.deepEqual(
        await erc20Bridged.nonces(initialHolder.address),
        ethers.utils.parseEther("0")
      );
    });

    it("DOMAIN_SEPARATOR()", async () => {
      const { erc20Bridged } = context;
      assert.equal(
        await erc20Bridged.DOMAIN_SEPARATOR(),
        domainSeparator(
          L2_TOKEN_NAME,
          L2_TOKEN_SINGING_DOMAIN_VERSION,
          CHAIN_ID,
          erc20Bridged.address
        )
      );
    });
  });

  describe("=== Permit ===", async () => {
    describe("*** EOA ***", async () => {
      it("works as expected", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
        } = context;

        const ownerAddr = initialHolder.address;
        const spenderAddrs = spender.address;
        const amount = ethers.utils.parseEther("1");
        const ownerNonce = 0;
        const deadline = ethers.constants.MaxUint256;

        const value = {
          owner: ownerAddr,
          spender: spenderAddrs,
          value: amount,
          nonce: ownerNonce,
          deadline,
        };

        const signature = await initialHolder._signTypedData(
          domain,
          types,
          value
        );
        const r = signature.slice(0, 66);
        const s = "0x" + signature.slice(66, 130);
        const v = "0x" + signature.slice(130, 132);

        const permitTx = await erc20Bridged.permit(
          ownerAddr,
          spenderAddrs,
          amount,
          deadline,
          v,
          r,
          s
        );
        await permitTx.wait();

        assert.deepEqual(
          await erc20Bridged.nonces(ownerAddr),
          BigNumber.from(1),
          "Incorrect owner nonce"
        );

        assert.deepEqual(
          await erc20Bridged.allowance(ownerAddr, spenderAddrs),
          amount,
          "Incorrect spender allowance"
        );
      });

      it("rejects reused signature", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
        } = context;

        const ownerAddr = initialHolder.address;
        const spenderAddrs = spender.address;
        const amount = ethers.utils.parseEther("1");
        const ownerNonce = 0;
        const deadline = ethers.constants.MaxUint256;

        const value = {
          owner: ownerAddr,
          spender: spenderAddrs,
          value: amount,
          nonce: ownerNonce,
          deadline,
        };

        const signature = await initialHolder._signTypedData(
          domain,
          types,
          value
        );
        const r = signature.slice(0, 66);
        const s = "0x" + signature.slice(66, 130);
        const v = "0x" + signature.slice(130, 132);

        await expect(
          erc20Bridged.permit(
            ownerAddr,
            spenderAddrs,
            amount,
            deadline,
            v,
            r,
            s
          )
        ).to.be.revertedWith("ERC20Permit: invalid signature");
      });

      it("rejects invalid signer", async () => {
        const {
          accounts: { initialHolder, spender, deployerWallet: invalidSigner },
          erc20Bridged,
          domain,
        } = context;

        const ownerAddr = initialHolder.address;
        const spenderAddrs = spender.address;
        const amount = ethers.utils.parseEther("1");
        const ownerNonce = 1;
        const deadline = ethers.constants.MaxUint256;

        const value = {
          owner: ownerAddr,
          spender: spenderAddrs,
          value: amount,
          nonce: ownerNonce,
          deadline,
        };

        const signature = await invalidSigner._signTypedData(
          domain,
          types,
          value
        );
        const r = signature.slice(0, 66);
        const s = "0x" + signature.slice(66, 130);
        const v = "0x" + signature.slice(130, 132);

        await expect(
          erc20Bridged.permit(
            ownerAddr,
            spenderAddrs,
            amount,
            deadline,
            v,
            r,
            s
          )
        ).to.be.revertedWith("ERC20Permit: invalid signature");
      });

      it("rejects expired permit deadline", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
        } = context;

        const ownerAddr = initialHolder.address;
        const spenderAddrs = spender.address;
        const amount = ethers.utils.parseEther("1");
        const ownerNonce = 1;
        const deadline = Math.floor(Date.now() / 1000) - 604_800; // 1 week = 604_800 s

        const value = {
          owner: ownerAddr,
          spender: spenderAddrs,
          value: amount,
          nonce: ownerNonce,
          deadline,
        };

        const signature = await initialHolder._signTypedData(
          domain,
          types,
          value
        );
        const r = signature.slice(0, 66);
        const s = "0x" + signature.slice(66, 130);
        const v = "0x" + signature.slice(130, 132);

        await expect(
          erc20Bridged.permit(
            ownerAddr,
            spenderAddrs,
            amount,
            deadline,
            v,
            r,
            s
          )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "ERC2612ExpiredSignature"
        );
      });
    });

    describe("*** ERC1271Wallet ***", async () => {
      it("works as expected", async () => {
        const {
          accounts: { spender, erc1271WalletOwner },
          erc20Bridged,
          erc1271Wallet,
          domain,
        } = context;

        const ownerAddr = erc1271Wallet.address;
        const spenderAddrs = spender.address;
        const amount = ethers.utils.parseEther("1");
        const ownerNonce = 0;
        const deadline = ethers.constants.MaxUint256;

        const value = {
          owner: ownerAddr,
          spender: spenderAddrs,
          value: amount,
          nonce: ownerNonce,
          deadline,
        };

        const signature = await erc1271WalletOwner._signTypedData(
          domain,
          types,
          value
        );
        const r = signature.slice(0, 66);
        const s = "0x" + signature.slice(66, 130);
        const v = "0x" + signature.slice(130, 132);

        const permitTx = await erc20Bridged.permit(
          ownerAddr,
          spenderAddrs,
          amount,
          deadline,
          v,
          r,
          s
        );
        await permitTx.wait();

        assert.deepEqual(
          await erc20Bridged.nonces(ownerAddr),
          BigNumber.from(1),
          "Incorrect owner nonce"
        );

        assert.deepEqual(
          await erc20Bridged.allowance(ownerAddr, spenderAddrs),
          amount,
          "Incorrect spender allowance"
        );
      });

      it("rejects reused signature", async () => {
        const {
          accounts: { spender, erc1271WalletOwner },
          erc20Bridged,
          erc1271Wallet,
          domain,
        } = context;

        const ownerAddr = erc1271Wallet.address;
        const spenderAddrs = spender.address;
        const amount = ethers.utils.parseEther("1");
        const ownerNonce = 0;
        const deadline = ethers.constants.MaxUint256;

        const value = {
          owner: ownerAddr,
          spender: spenderAddrs,
          value: amount,
          nonce: ownerNonce,
          deadline,
        };

        const signature = await erc1271WalletOwner._signTypedData(
          domain,
          types,
          value
        );
        const r = signature.slice(0, 66);
        const s = "0x" + signature.slice(66, 130);
        const v = "0x" + signature.slice(130, 132);

        await expect(
          erc20Bridged.permit(
            ownerAddr,
            spenderAddrs,
            amount,
            deadline,
            v,
            r,
            s
          )
        ).to.be.revertedWith("ERC20Permit: invalid signature");
      });

      it("rejects invalid signer", async () => {
        const {
          accounts: { spender, deployerWallet: invalidSigner },
          erc20Bridged,
          erc1271Wallet,
          domain,
        } = context;

        const ownerAddr = erc1271Wallet.address;
        const spenderAddrs = spender.address;
        const amount = ethers.utils.parseEther("1");
        const ownerNonce = 1;
        const deadline = ethers.constants.MaxUint256;

        const value = {
          owner: ownerAddr,
          spender: spenderAddrs,
          value: amount,
          nonce: ownerNonce,
          deadline,
        };

        const signature = await invalidSigner._signTypedData(
          domain,
          types,
          value
        );
        const r = signature.slice(0, 66);
        const s = "0x" + signature.slice(66, 130);
        const v = "0x" + signature.slice(130, 132);

        await expect(
          erc20Bridged.permit(
            ownerAddr,
            spenderAddrs,
            amount,
            deadline,
            v,
            r,
            s
          )
        ).to.be.revertedWith("ERC20Permit: invalid signature");
      });

      it("rejects expired permit deadline", async () => {
        const {
          accounts: { spender, erc1271WalletOwner },
          erc20Bridged,
          erc1271Wallet,
          domain,
        } = context;

        const ownerAddr = erc1271Wallet.address;
        const spenderAddrs = spender.address;
        const amount = ethers.utils.parseEther("1");
        const ownerNonce = 1;
        const deadline = Math.floor(Date.now() / 1000) - 604_800; // 1 week = 604_800 s

        const value = {
          owner: ownerAddr,
          spender: spenderAddrs,
          value: amount,
          nonce: ownerNonce,
          deadline,
        };

        const signature = await erc1271WalletOwner._signTypedData(
          domain,
          types,
          value
        );
        const r = signature.slice(0, 66);
        const s = "0x" + signature.slice(66, 130);
        const v = "0x" + signature.slice(130, 132);

        await expect(
          erc20Bridged.permit(
            ownerAddr,
            spenderAddrs,
            amount,
            deadline,
            v,
            r,
            s
          )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "ERC2612ExpiredSignature"
        );
      });
    });
  });
});

const freezeAddress = async (
  erc20: ethers.Contract,
  freezer: Wallet,
  toFreeze: Wallet
) => {
  const freezeTx = await erc20.connect(freezer).freezeAddress(toFreeze.address);
  await freezeTx.wait();

  assert.deepEqual(
    await erc20.isAddressFrozen(toFreeze.address),
    true,
    "Address was not frozen"
  );
};

const unfreezeAddress = async (
  erc20: ethers.Contract,
  freezer: Wallet,
  toFreeze: Wallet
) => {
  const freezeTx = await erc20
    .connect(freezer)
    .unfreezeAddress(toFreeze.address);
  await freezeTx.wait();

  assert.deepEqual(
    await erc20.isAddressFrozen(toFreeze.address),
    false,
    "Address was not unfrozen"
  );
};

const freezeAndBurn = async (
  erc20: ethers.Contract,
  admin: Wallet,
  toFreezeAndBurn: Wallet
) => {
  const freezeTx = await erc20
    .connect(admin)
    .freezeAddress(toFreezeAndBurn.address);
  await freezeTx.wait();

  assert.deepEqual(
    await erc20.isAddressFrozen(toFreezeAndBurn.address),
    true,
    "Address was not frozen"
  );

  // TODO: Once escrow contract is in place, check its balance instead
  const adminBalanceBeforeBurn = await erc20.balanceOf(admin.address);
  const userBalanceBeforeBurn = await erc20.balanceOf(toFreezeAndBurn.address);

  const burnTx = await erc20
    .connect(admin)
    .burnFrozenTokens(toFreezeAndBurn.address);
  await burnTx.wait();

  // User balance should be 0
  assert.deepEqual(
    await erc20.balanceOf(toFreezeAndBurn.address),
    BigNumber.from(0),
    "Tokens were not burned"
  );

  // Admin (later escrow) balance should increase by the burned token amount
  assert.deepEqual(
    await erc20.balanceOf(admin.address),
    adminBalanceBeforeBurn.add(userBalanceBeforeBurn),
    "Tokens were not burned"
  );
};

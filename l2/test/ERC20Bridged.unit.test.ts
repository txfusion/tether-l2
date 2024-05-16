import { assert, expect } from "chai";
import { describe } from "mocha";
import { BigNumber, ethers } from "ethers";
import { Wallet } from "zksync-ethers";
import { setup } from "./setup/erc20.setup";
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

  beforeEach("Setting up the context", async () => {
    context = await setup();
  });

  describe("=== Getters ===", async () => {
    it("*** Bridge ***", async () => {
      const {
        accounts: { admin },
        erc20Bridged,
      } = context;

      assert.equal(await erc20Bridged.bridge(), admin.address);
    });

    it("*** Name ***", async () => {
      const {
        erc20Bridged,
        erc20Metadata: { name },
      } = context;

      assert.equal(await erc20Bridged.name(), name);
    });

    it("*** Symbol ***", async () => {
      const {
        erc20Bridged,
        erc20Metadata: { symbol },
      } = context;

      assert.equal(await erc20Bridged.symbol(), symbol);
    });

    it("*** Decimals ***", async () => {
      const {
        erc20Bridged,
        erc20Metadata: { decimals },
      } = context;

      assert.equal(await erc20Bridged.decimals(), decimals);
    });

    it("*** Nonces ***", async () => {
      const {
        accounts: { initialHolder },
        erc20Bridged,
      } = context;
      assert.deepEqual(
        (await erc20Bridged.nonces(initialHolder.address)).toString(),
        BigNumber.from(0).toString()
      );
    });

    it("*** Domain Separator ***", async () => {
      const {
        erc20Bridged,
        domain: { name, version, chainId },
      } = context;
      assert.equal(
        await erc20Bridged.DOMAIN_SEPARATOR(),
        domainSeparator(name, version, chainId, erc20Bridged.address)
      );
    });
  });

  describe("=== Blacklist ===", async () => {
    it("Non-owners cannot blacklist", async () => {
      const {
        accounts: { initialHolder, spender },
        erc20Bridged,
      } = context;

      await expect(
        erc20Bridged.connect(initialHolder).addToBlockedList(spender.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Admins can blacklist", async () => {
      const {
        accounts: { initialHolder, admin },
        erc20Bridged,
      } = context;

      await addToBlockedList(erc20Bridged, admin, initialHolder);
    });

    describe("=== Destroy blocked funds ===", async () => {
      it("Non-admins cannot destroy blocked funds", async () => {
        const {
          accounts: { initialHolder, admin },
          erc20Bridged,
        } = context;

        await expect(
          erc20Bridged.connect(initialHolder).destroyBlockedFunds(admin.address)
        ).to.be.revertedWith(`Ownable: caller is not the owner`);
      });

      it("Admins cannot destroy non-blocked funds", async () => {
        const {
          accounts: { initialHolder, admin },
          erc20Bridged,
        } = context;
        await expect(
          erc20Bridged.connect(admin).destroyBlockedFunds(initialHolder.address)
        ).to.be.revertedWith("TetherToken: user is not blocked");
      });

      it("Admins can destroy blocked funds", async () => {
        const {
          accounts: { initialHolder, admin },
          erc20Bridged,
        } = context;

        await blockAndDestroyBlockedFunds(erc20Bridged, admin, initialHolder);
      });
    });

    describe("*** Transfer ***", async () => {
      it("Blocked account cannot use transfer()", async () => {
        const {
          accounts: { initialHolder, admin },
          erc20Bridged,
          DEFAULT_AMOUNT,
        } = context;

        await addToBlockedList(erc20Bridged, admin, initialHolder);

        await expect(
          erc20Bridged
            .connect(initialHolder)
            .transfer(admin.address, DEFAULT_AMOUNT)
        ).to.be.revertedWith("TetherToken: from is blocked");
      });

      it("Non-blocked account can use transfer()", async () => {
        const {
          accounts: { initialHolder, admin },
          erc20Bridged,
          DEFAULT_AMOUNT,
        } = context;

        await removeFromBlockedList(erc20Bridged, admin, initialHolder);

        const transferTx = await erc20Bridged
          .connect(initialHolder)
          .transfer(admin.address, DEFAULT_AMOUNT);
        await transferTx.wait();

        expect(await erc20Bridged.balanceOf(admin.address)).to.be.equal(
          DEFAULT_AMOUNT
        );
      });
    });

    describe("*** Transfer From ***", async () => {
      it("Blocked account cannot use transferFrom()", async () => {
        const {
          accounts: { initialHolder, admin, spender },
          erc20Bridged,
          DEFAULT_AMOUNT,
        } = context;

        await (
          await erc20Bridged
            .connect(initialHolder)
            .approve(spender.address, DEFAULT_AMOUNT)
        ).wait();

        await addToBlockedList(erc20Bridged, admin, initialHolder);

        await expect(
          erc20Bridged
            .connect(spender)
            .transferFrom(initialHolder.address, admin.address, DEFAULT_AMOUNT)
        ).to.be.revertedWith("TetherToken: from is blocked");
      });

      it("Non-blocked account cannot use transferFrom() to send to Tether contract", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          DEFAULT_AMOUNT,
        } = context;

        await (
          await erc20Bridged
            .connect(initialHolder)
            .approve(spender.address, DEFAULT_AMOUNT)
        ).wait();

        await expect(
          erc20Bridged
            .connect(spender)
            .transferFrom(
              initialHolder.address,
              erc20Bridged.address,
              DEFAULT_AMOUNT
            )
        ).to.be.revertedWith("TetherToken: transfer to the contract address");
      });

      it("Non-blocked account can use transferFrom()", async () => {
        const {
          accounts: { initialHolder, admin, spender },
          erc20Bridged,
          DEFAULT_AMOUNT,
        } = context;

        await (
          await erc20Bridged
            .connect(initialHolder)
            .approve(spender.address, DEFAULT_AMOUNT)
        ).wait();

        await removeFromBlockedList(erc20Bridged, admin, initialHolder);

        await (
          await erc20Bridged
            .connect(spender)
            .transferFrom(initialHolder.address, admin.address, DEFAULT_AMOUNT)
        ).wait();

        expect(await erc20Bridged.balanceOf(admin.address)).to.be.equal(
          DEFAULT_AMOUNT
        );
      });
    });
  });

  describe("=== Permit ===", async () => {
    describe("*** EOA ***", async () => {
      it(">>> Works as expected", async () => {
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

        assert.isTrue(
          (await erc20Bridged.nonces(ownerAddr)).eq(1),
          // BigNumber.from(1).toString(),
          "Incorrect owner nonce"
        );

        assert.isTrue(
          (await erc20Bridged.allowance(ownerAddr, spenderAddrs)).eq(amount),
          "Incorrect spender allowance"
        );
      });

      it("Rejects reused signature", async () => {
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

      it("Rejects invalid signer", async () => {
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

      it("Rejects expired permit deadline", async () => {
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
      it(">>> Works as expected", async () => {
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

        assert.isTrue(
          (await erc20Bridged.nonces(ownerAddr)).eq(1),
          "Incorrect owner nonce"
        );

        assert.isTrue(
          (await erc20Bridged.allowance(ownerAddr, spenderAddrs)).eq(amount),
          "Incorrect spender allowance"
        );
      });

      it("Rejects reused signature", async () => {
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

      it("Rejects invalid signer", async () => {
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

      it("Rejects expired permit deadline", async () => {
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

const addToBlockedList = async (
  erc20: ethers.Contract,
  admin: Wallet,
  toBlocklist: Wallet
) => {
  const freezeTx = await erc20
    .connect(admin)
    .addToBlockedList(toBlocklist.address);
  await freezeTx.wait();

  assert.deepEqual(
    await erc20.isBlocked(toBlocklist.address),
    true,
    "Address was not added to the blocklist"
  );
};

const removeFromBlockedList = async (
  erc20: ethers.Contract,
  admin: Wallet,
  toBlocklist: Wallet
) => {
  const freezeTx = await erc20
    .connect(admin)
    .removeFromBlockedList(toBlocklist.address);
  await freezeTx.wait();

  assert.deepEqual(
    await erc20.isBlocked(toBlocklist.address),
    false,
    "Address was not removed from the blocklist"
  );
};

const blockAndDestroyBlockedFunds = async (
  erc20: ethers.Contract,
  admin: Wallet,
  toDestroy: Wallet
) => {
  await addToBlockedList(erc20, admin, toDestroy);

  const burnTx = await erc20
    .connect(admin)
    .destroyBlockedFunds(toDestroy.address);
  await burnTx.wait();

  // User balance should be 0
  assert.isTrue(
    (await erc20.balanceOf(toDestroy.address)).eq(0),
    "Tokens were not destroyed"
  );
};

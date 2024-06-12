import { assert, expect } from "chai";
import { describe } from "mocha";
import { BigNumber, ethers } from "ethers";
import { Wallet } from "zksync-ethers";
import { setup } from "./setup/erc20.setup";
import {
  EIP712Operations,
  getEIP712Operation,
  signTypedData,
  domainSeparator,
} from "./utils/eip712";
import { TetherZkSync } from "../typechain";
import { TETHER_CONSTANTS } from "../../common-utils";

describe("~~~~~ ERC20Bridged ~~~~~", async () => {
  let context: Awaited<ReturnType<typeof setup>>;

  beforeEach("Setting up the context", async () => {
    context = await setup();
  });

  describe("=== Getters ===", async () => {
    it("*** Bridge ***", async () => {
      const {
        accounts: { bridge },
        erc20Bridged,
      } = context;

      assert.equal(await erc20Bridged.bridge(), bridge.address);
    });

    it("*** Name ***", async () => {
      const { erc20Bridged } = context;

      assert.equal(await erc20Bridged.name(), TETHER_CONSTANTS.NAME);
    });

    it("*** Symbol ***", async () => {
      const { erc20Bridged } = context;

      assert.equal(await erc20Bridged.symbol(), TETHER_CONSTANTS.SYMBOL);
    });

    it("*** Decimals ***", async () => {
      const { erc20Bridged } = context;

      assert.equal(await erc20Bridged.decimals(), TETHER_CONSTANTS.DECIMALS);
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

  describe("=== Blocklist ===", async () => {
    it("should revert if the non-owner is trying to add users to the blocklist", async () => {
      const {
        accounts: { initialHolder, spender },
        erc20Bridged,
      } = context;

      await expect(
        erc20Bridged.connect(initialHolder).addToBlockedList(spender.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert if the non-owner is trying to remove users to the blocklist", async () => {
      const {
        accounts: { initialHolder, spender },
        erc20Bridged,
      } = context;

      await expect(
        erc20Bridged
          .connect(initialHolder)
          .removeFromBlockedList(spender.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it(">>> works as expected (add to blocked list)", async () => {
      const {
        accounts: { initialHolder, bridge },
        erc20Bridged,
      } = context;

      await addToBlockedList(erc20Bridged, bridge, initialHolder);
    });

    it(">>> works as expected (remove from blocked list)", async () => {
      const {
        accounts: { initialHolder, bridge },
        erc20Bridged,
      } = context;

      await addToBlockedList(erc20Bridged, bridge, initialHolder);
      await removeFromBlockedList(erc20Bridged, bridge, initialHolder);
    });

    describe("*** Destroy blocked funds ***", async () => {
      it("should revert if non-admin is trying to destroy blocked funds", async () => {
        const {
          accounts: { initialHolder, bridge },
          erc20Bridged,
        } = context;

        await expect(
          erc20Bridged
            .connect(initialHolder)
            .destroyBlockedFunds(bridge.address)
        ).to.be.revertedWith(`Ownable: caller is not the owner`);
      });

      it("should revert if bridges is trying to destroy non-blocked account's funds", async () => {
        const {
          accounts: { initialHolder, bridge },
          erc20Bridged,
        } = context;
        await expect(
          erc20Bridged
            .connect(bridge)
            .destroyBlockedFunds(initialHolder.address)
        ).to.be.revertedWith("TetherToken: user is not blocked");
      });

      it(">>> works as expected", async () => {
        const {
          accounts: { initialHolder, bridge },
          erc20Bridged,
        } = context;

        await blockAndDestroyBlockedFunds(erc20Bridged, bridge, initialHolder);
      });
    });

    describe("*** Transfer ***", async () => {
      it("should revert if a blocked account is trying to use transfer()", async () => {
        const {
          accounts: { initialHolder, bridge },
          erc20Bridged,
          DEFAULT_AMOUNT,
        } = context;

        await addToBlockedList(erc20Bridged, bridge, initialHolder);

        await expect(
          erc20Bridged
            .connect(initialHolder)
            .transfer(bridge.address, DEFAULT_AMOUNT)
        ).to.be.revertedWith("TetherToken: from is blocked");
      });

      it("should revert if the someone is trying to use transfer() to send to Tether contract", async () => {
        const {
          accounts: { initialHolder },
          erc20Bridged,
          DEFAULT_AMOUNT,
        } = context;

        await expect(
          erc20Bridged
            .connect(initialHolder)
            .transfer(erc20Bridged.address, DEFAULT_AMOUNT)
        ).to.be.revertedWith("TetherToken: transfer to the contract address");
      });

      it(">>> works as expected (non-blocked account can use transfer())", async () => {
        const {
          accounts: { initialHolder, bridge },
          erc20Bridged,
          DEFAULT_AMOUNT,
        } = context;

        await removeFromBlockedList(erc20Bridged, bridge, initialHolder);

        const transferTx = await erc20Bridged
          .connect(initialHolder)
          .transfer(bridge.address, DEFAULT_AMOUNT);
        await transferTx.wait();

        expect(await erc20Bridged.balanceOf(bridge.address)).to.be.equal(
          DEFAULT_AMOUNT
        );
      });
    });

    describe("*** Transfer From ***", async () => {
      it("should revert if blocked account is trying to use transferFrom()", async () => {
        const {
          accounts: { initialHolder, bridge, spender },
          erc20Bridged,
          DEFAULT_AMOUNT,
        } = context;

        await addToBlockedList(erc20Bridged, bridge, initialHolder);

        await expect(
          erc20Bridged
            .connect(initialHolder)
            .transferFrom(initialHolder.address, bridge.address, DEFAULT_AMOUNT)
        ).to.be.revertedWith("Blocked: msg.sender is blocked");
      });

      it("should revert if someone is trying to use transferFrom() from the blocked account", async () => {
        const {
          accounts: { initialHolder, bridge, spender },
          erc20Bridged,
          DEFAULT_AMOUNT,
        } = context;

        await (
          await erc20Bridged
            .connect(initialHolder)
            .approve(spender.address, DEFAULT_AMOUNT)
        ).wait();

        await addToBlockedList(erc20Bridged, bridge, initialHolder);

        await expect(
          erc20Bridged
            .connect(spender)
            .transferFrom(initialHolder.address, bridge.address, DEFAULT_AMOUNT)
        ).to.be.revertedWith("TetherToken: from is blocked");
      });

      it("should revert if the someone is trying to use transferFrom() to send to Tether contract", async () => {
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

      it(">>> works as expected (non-blocked account can use transferFrom())", async () => {
        const {
          accounts: { initialHolder, bridge, spender },
          erc20Bridged,
          DEFAULT_AMOUNT,
        } = context;

        await (
          await erc20Bridged
            .connect(initialHolder)
            .approve(spender.address, DEFAULT_AMOUNT)
        ).wait();

        await removeFromBlockedList(erc20Bridged, bridge, initialHolder);

        await (
          await erc20Bridged
            .connect(spender)
            .transferFrom(initialHolder.address, bridge.address, DEFAULT_AMOUNT)
        ).wait();

        expect(await erc20Bridged.balanceOf(bridge.address)).to.be.equal(
          DEFAULT_AMOUNT
        );
      });
    });
  });

  describe("=== Permit ===", async () => {
    describe("*** EOA ***", async () => {
      it("should revert if the signature's deadline has been exceeded", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
        } = context;

        const ownerAddr = initialHolder.address;
        const spenderAddr = spender.address;
        const amount = ethers.utils.parseEther("1");
        const ownerNonce = await erc20Bridged.nonces(ownerAddr);
        const deadline = BigNumber.from(0);

        const { type, data } = getEIP712Operation(EIP712Operations.PERMIT, {
          owner: ownerAddr,
          spender: spenderAddr,
          value: amount,
          nonce: ownerNonce,
          deadline: deadline,
        });
        const signature = await signTypedData(
          domain,
          type,
          data,
          initialHolder
        );

        await expect(
          erc20Bridged["permit(address,address,uint256,uint256,bytes)"](
            ownerAddr,
            spenderAddr,
            amount,
            deadline,
            signature
          )
        ).to.be.revertedWith("ERC20Permit: expired deadline");
      });

      it("should revert if the signature has already been used", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
        } = context;

        const { owner, value, deadline, signature } = await validPermit(
          initialHolder,
          spender,
          erc20Bridged,
          domain
        );

        await expect(
          erc20Bridged["permit(address,address,uint256,uint256,bytes)"](
            owner.address,
            spender.address,
            value,
            deadline,
            signature
          )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorInvalidSignature"
        );
      });

      it("should revert if the signature has been signed by someone else than the owner", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
        } = context;

        const ownerAddr = initialHolder.address;
        const spenderAddr = spender.address;
        const amount = ethers.utils.parseEther("1");
        const ownerNonce = await erc20Bridged.nonces(ownerAddr);
        const deadline = ethers.constants.MaxUint256;

        const { type, data } = getEIP712Operation(EIP712Operations.PERMIT, {
          owner: ownerAddr,
          spender: spenderAddr,
          value: amount,
          nonce: ownerNonce,
          deadline: deadline,
        });
        const signature = await signTypedData(domain, type, data, spender); // spender signinig instead of initialHolder

        await expect(
          erc20Bridged["permit(address,address,uint256,uint256,bytes)"](
            ownerAddr,
            spenderAddr,
            amount,
            deadline,
            signature
          )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorInvalidSignature"
        );
      });

      it(">>> works as expected (using r,s,v)", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const deadline = ethers.constants.MaxUint256;

        const { type, data } = getEIP712Operation(EIP712Operations.PERMIT, {
          owner: initialHolder.address,
          spender: spender.address,
          value: DEFAULT_AMOUNT,
          nonce: await erc20Bridged.nonces(initialHolder.address),
          deadline: deadline,
        });
        const signature = await signTypedData(
          domain,
          type,
          data,
          initialHolder
        );

        const r = signature.slice(0, 66);
        const s = "0x" + signature.slice(66, 130);
        const v = "0x" + signature.slice(130, 132);

        await (
          await erc20Bridged[
            "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)"
          ](
            initialHolder.address,
            spender.address,
            DEFAULT_AMOUNT,
            deadline,
            v,
            r,
            s
          )
        ).wait();

        assert.isTrue(
          (await erc20Bridged.nonces(initialHolder.address)).eq(1),
          "Incorrect owner nonce"
        );

        assert.isTrue(
          (
            await erc20Bridged.allowance(initialHolder.address, spender.address)
          ).eq(DEFAULT_AMOUNT),
          "Incorrect spender allowance"
        );
      });

      it(">>> works as expected (using full signature)", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
        } = context;

        const { value } = await validPermit(
          initialHolder,
          spender,
          erc20Bridged,
          domain
        );

        assert.isTrue(
          (await erc20Bridged.nonces(initialHolder.address)).eq(1),
          "Incorrect owner nonce"
        );

        assert.isTrue(
          (
            await erc20Bridged.allowance(initialHolder.address, spender.address)
          ).eq(value),
          "Incorrect spender allowance"
        );
      });
    });

    describe("*** ERC1271Wallet ***", async () => {
      it("should revert if the signature's deadline has been exceeded", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
        } = context;

        const ownerAddr = erc1271Wallet.address;
        const spenderAddr = spender.address;
        const amount = ethers.utils.parseEther("1");
        const ownerNonce = await erc20Bridged.nonces(ownerAddr);
        const deadline = BigNumber.from(0);

        const { type, data } = getEIP712Operation(EIP712Operations.PERMIT, {
          owner: ownerAddr,
          spender: spenderAddr,
          value: amount,
          nonce: ownerNonce,
          deadline: deadline,
        });
        const signature = await signTypedData(
          domain,
          type,
          data,
          erc1271WalletOwner
        );

        await expect(
          erc20Bridged["permit(address,address,uint256,uint256,bytes)"](
            ownerAddr,
            spenderAddr,
            amount,
            deadline,
            signature
          )
        ).to.be.revertedWith("ERC20Permit: expired deadline");
      });

      it("should revert if the signature has already been used", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
        } = context;

        const { value, deadline, signature } = await validPermit(
          erc1271WalletOwner,
          spender,
          erc20Bridged,
          domain,
          {
            erc1271WalletContract: erc1271Wallet.address,
          }
        );

        await expect(
          erc20Bridged["permit(address,address,uint256,uint256,bytes)"](
            erc1271Wallet.address,
            spender.address,
            value,
            deadline,
            signature
          )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorInvalidSignature"
        );
      });

      it("should revert if the signature has been signed by someone else than the owner", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
        } = context;

        const ownerAddr = erc1271Wallet.address;
        const spenderAddr = spender.address;
        const amount = ethers.utils.parseEther("1");
        const ownerNonce = await erc20Bridged.nonces(ownerAddr);
        const deadline = ethers.constants.MaxUint256;

        const { type, data } = getEIP712Operation(EIP712Operations.PERMIT, {
          owner: ownerAddr,
          spender: spenderAddr,
          value: amount,
          nonce: ownerNonce,
          deadline: deadline,
        });
        const signature = await signTypedData(domain, type, data, spender);

        await expect(
          erc20Bridged["permit(address,address,uint256,uint256,bytes)"](
            ownerAddr,
            spender.address,
            amount,
            deadline,
            signature
          )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorInvalidSignature"
        );
      });

      it(">>> works as expected (using r,s,v)", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const deadline = ethers.constants.MaxUint256;

        const { type, data } = getEIP712Operation(EIP712Operations.PERMIT, {
          owner: erc1271Wallet.address,
          spender: spender.address,
          value: DEFAULT_AMOUNT,
          nonce: await erc20Bridged.nonces(erc1271WalletOwner.address),
          deadline: deadline,
        });
        const signature = await signTypedData(
          domain,
          type,
          data,
          erc1271WalletOwner
        );

        const r = signature.slice(0, 66);
        const s = "0x" + signature.slice(66, 130);
        const v = "0x" + signature.slice(130, 132);

        await (
          await erc20Bridged[
            "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)"
          ](
            erc1271Wallet.address,
            spender.address,
            DEFAULT_AMOUNT,
            deadline,
            v,
            r,
            s
          )
        ).wait();

        assert.isTrue(
          (await erc20Bridged.nonces(erc1271Wallet.address)).eq(1),
          "Incorrect owner nonce"
        );

        assert.isTrue(
          (
            await erc20Bridged.allowance(erc1271Wallet.address, spender.address)
          ).eq(DEFAULT_AMOUNT),
          "Incorrect spender allowance"
        );
      });

      it(">>> works as expected (using full signature)", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
        } = context;

        const { value } = await validPermit(
          erc1271WalletOwner,
          spender,
          erc20Bridged,
          domain,
          {
            erc1271WalletContract: erc1271Wallet.address,
          }
        );

        assert.isTrue(
          (await erc20Bridged.nonces(erc1271Wallet.address)).eq(1),
          "Incorrect owner nonce"
        );

        assert.isTrue(
          (
            await erc20Bridged.allowance(erc1271Wallet.address, spender.address)
          ).eq(value),
          "Incorrect spender allowance"
        );
      });
    });
  });

  describe("=== Transfer with Authorization ===", async () => {
    describe("*** EOA ***", async () => {
      it("should revert if the signature's validAfter hasn't been reached", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const validAfter = ethers.constants.MaxUint256;
        const validBefore = ethers.constants.MaxUint256;
        const fromNonce = ethers.BigNumber.from(
          ethers.utils.randomBytes(32)
        )._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.TRANSFER_WITH_AUTHORIZATION,
          {
            from: initialHolder.address,
            to: spender.address,
            value: DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce: fromNonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          initialHolder
        );

        await expect(
          erc20Bridged[
            "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
          ](
            initialHolder.address,
            spender.address,
            DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            fromNonce,
            signature
          )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorAuthEarly"
        );
      });

      it("should revert if the signature's validBefore has been exceeded", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const validAfter = BigNumber.from(0);
        const validBefore = validAfter;
        const fromNonce = ethers.BigNumber.from(
          ethers.utils.randomBytes(32)
        )._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.TRANSFER_WITH_AUTHORIZATION,
          {
            from: initialHolder.address,
            to: spender.address,
            value: DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce: fromNonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          initialHolder
        );

        await expect(
          erc20Bridged[
            "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
          ](
            initialHolder.address,
            spender.address,
            DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            fromNonce,
            signature
          )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorAuthExpired"
        );
      });

      it("should revert if the nonce has already been used", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const { nonce, validAfter, validBefore, signature } =
          await validTransferWithAuthorization(
            initialHolder,
            spender,
            erc20Bridged,
            domain,
            DEFAULT_AMOUNT
          );

        await expect(
          erc20Bridged[
            "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
          ](
            initialHolder.address,
            spender.address,
            DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce,
            signature
          )
        )
          .to.be.revertedWithCustomError(
            erc20Bridged,
            "EIP3009Upgradeable__ErrorNonceAlreadyUsed"
          )
          .withArgs(nonce);
      });

      it("should revert if the signature has been signed by someone else other than the owner", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const validAfter = 0;
        const validBefore = ethers.constants.MaxUint256;
        const fromNonce = ethers.BigNumber.from(
          ethers.utils.randomBytes(32)
        )._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.TRANSFER_WITH_AUTHORIZATION,
          {
            from: initialHolder.address,
            to: spender.address,
            value: DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce: fromNonce,
          }
        );
        const signature = await signTypedData(domain, type, data, spender);

        await expect(
          erc20Bridged[
            "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
          ](
            initialHolder.address,
            spender.address,
            DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            fromNonce,
            signature
          )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorInvalidSignature"
        );
      });

      it(">>> works as expected (using r,s,v)", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        assert.isTrue(
          (await erc20Bridged.balanceOf(spender.address)).eq(BigNumber.from(0))
        );

        const validAfter = BigNumber.from(0);
        const validBefore = ethers.constants.MaxUint256;
        const fromNonce = ethers.BigNumber.from(
          ethers.utils.randomBytes(32)
        )._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.TRANSFER_WITH_AUTHORIZATION,
          {
            from: initialHolder.address,
            to: spender.address,
            value: DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce: fromNonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          initialHolder
        );

        const r = signature.slice(0, 66);
        const s = "0x" + signature.slice(66, 130);
        const v = "0x" + signature.slice(130, 132);

        const transferTx = await erc20Bridged[
          "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)"
        ](
          initialHolder.address,
          spender.address,
          DEFAULT_AMOUNT,
          validAfter,
          validBefore,
          fromNonce,
          v,
          r,
          s
        );

        expect(transferTx)
          .to.emit(erc20Bridged, "EIP3009Upgradeable__AuthorizationUsed")
          .withArgs(initialHolder.address, fromNonce)
          .to.emit(erc20Bridged, "Transfer")
          .withArgs(initialHolder.address, spender.address, DEFAULT_AMOUNT);

        await transferTx.wait();

        assert.isTrue(
          (await erc20Bridged.balanceOf(spender.address)).eq(DEFAULT_AMOUNT),
          "Incorrect spender balance"
        );
      });

      it(">>> works as expected (using full signature)", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        assert.isTrue(
          (await erc20Bridged.balanceOf(spender.address)).eq(BigNumber.from(0))
        );

        await validTransferWithAuthorization(
          initialHolder,
          spender,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT
        );

        assert.isTrue(
          (await erc20Bridged.balanceOf(spender.address)).eq(DEFAULT_AMOUNT),
          "Incorrect spender balance"
        );
      });
    });

    describe("*** ERC1271Wallet ***", async () => {
      it("should revert if the signature's validAfter hasn't been reached", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const validAfter = ethers.constants.MaxUint256;
        const validBefore = ethers.constants.MaxUint256;
        const fromNonce = ethers.BigNumber.from(
          ethers.utils.randomBytes(32)
        )._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.TRANSFER_WITH_AUTHORIZATION,
          {
            from: erc1271Wallet.address,
            to: spender.address,
            value: DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce: fromNonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          erc1271WalletOwner
        );

        await expect(
          erc20Bridged[
            "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
          ](
            erc1271Wallet.address,
            spender.address,
            DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            fromNonce,
            signature
          )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorAuthEarly"
        );
      });

      it("should revert if the signature's validBefore has been exceeded", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const validAfter = BigNumber.from(0);
        const validBefore = validAfter;
        const fromNonce = ethers.BigNumber.from(
          ethers.utils.randomBytes(32)
        )._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.TRANSFER_WITH_AUTHORIZATION,
          {
            from: erc1271Wallet.address,
            to: spender.address,
            value: DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce: fromNonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          erc1271WalletOwner
        );

        await expect(
          erc20Bridged[
            "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
          ](
            erc1271Wallet.address,
            spender.address,
            DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            fromNonce,
            signature
          )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorAuthExpired"
        );
      });

      it("should revert if the nonce has already been used", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const { nonce, validAfter, validBefore, signature } =
          await validTransferWithAuthorization(
            erc1271WalletOwner,
            spender,
            erc20Bridged,
            domain,
            DEFAULT_AMOUNT,
            {
              erc1271WalletContract: erc1271Wallet.address,
            }
          );

        await expect(
          erc20Bridged[
            "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
          ](
            erc1271Wallet.address,
            spender.address,
            DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce,
            signature
          )
        )
          .to.be.revertedWithCustomError(
            erc20Bridged,
            "EIP3009Upgradeable__ErrorNonceAlreadyUsed"
          )
          .withArgs(nonce);
      });

      it("should revert if the signature has been signed by someone else other than the owner", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const validAfter = 0;
        const validBefore = ethers.constants.MaxUint256;
        const fromNonce = ethers.BigNumber.from(
          ethers.utils.randomBytes(32)
        )._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.TRANSFER_WITH_AUTHORIZATION,
          {
            from: erc1271Wallet.address,
            to: spender.address,
            value: DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce: fromNonce,
          }
        );
        const signature = await signTypedData(domain, type, data, spender);

        await expect(
          erc20Bridged[
            "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
          ](
            erc1271Wallet.address,
            spender.address,
            DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            fromNonce,
            signature
          )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorInvalidSignature"
        );
      });

      it(">>> works as expected (using r,s,v)", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        assert.isTrue(
          (await erc20Bridged.balanceOf(spender.address)).eq(BigNumber.from(0))
        );

        const validAfter = BigNumber.from(0);
        const validBefore = ethers.constants.MaxUint256;
        const fromNonce = ethers.BigNumber.from(
          ethers.utils.randomBytes(32)
        )._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.TRANSFER_WITH_AUTHORIZATION,
          {
            from: erc1271Wallet.address,
            to: spender.address,
            value: DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce: fromNonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          erc1271WalletOwner
        );

        const r = signature.slice(0, 66);
        const s = "0x" + signature.slice(66, 130);
        const v = "0x" + signature.slice(130, 132);

        const transferTx = await erc20Bridged[
          "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)"
        ](
          erc1271Wallet.address,
          spender.address,
          DEFAULT_AMOUNT,
          validAfter,
          validBefore,
          fromNonce,
          v,
          r,
          s
        );

        expect(transferTx)
          .to.emit(erc20Bridged, "EIP3009Upgradeable__AuthorizationUsed")
          .withArgs(erc1271Wallet.address, fromNonce)
          .to.emit(erc20Bridged, "Transfer")
          .withArgs(erc1271Wallet.address, spender.address, DEFAULT_AMOUNT);

        await transferTx.wait();

        assert.isTrue(
          (await erc20Bridged.balanceOf(spender.address)).eq(DEFAULT_AMOUNT),
          "Incorrect spender balance"
        );
      });

      it(">>> works as expected (using full signature)", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        assert.isTrue(
          (await erc20Bridged.balanceOf(spender.address)).eq(BigNumber.from(0))
        );

        await validTransferWithAuthorization(
          erc1271WalletOwner,
          spender,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
          {
            erc1271WalletContract: erc1271Wallet.address,
          }
        );

        assert.isTrue(
          (await erc20Bridged.balanceOf(spender.address)).eq(DEFAULT_AMOUNT),
          "Incorrect spender balance"
        );
      });
    });
  });

  describe("=== Receive with Authorization ===", async () => {
    describe("*** EOA ***", async () => {
      it("should revert if the receiver is not sending the transaction", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const validAfter = 0;
        const validBefore = ethers.constants.MaxUint256;
        const fromNonce = ethers.BigNumber.from(
          ethers.utils.randomBytes(32)
        )._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.RECEIVE_WITH_AUTHORIZATION,
          {
            from: initialHolder.address,
            to: spender.address,
            value: DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce: fromNonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          initialHolder
        );

        await expect(
          erc20Bridged[
            "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
          ](
            initialHolder.address,
            spender.address,
            DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            fromNonce,
            signature
          )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorUnauthorized"
        );
      });

      it("should revert if the signature's validAfter hasn't been reached", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const validAfter = ethers.constants.MaxUint256;
        const validBefore = ethers.constants.MaxUint256;
        const fromNonce = ethers.BigNumber.from(
          ethers.utils.randomBytes(32)
        )._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.RECEIVE_WITH_AUTHORIZATION,
          {
            from: initialHolder.address,
            to: spender.address,
            value: DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce: fromNonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          initialHolder
        );

        await expect(
          erc20Bridged
            .connect(spender)
            [
              "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
            ](
              initialHolder.address,
              spender.address,
              DEFAULT_AMOUNT,
              validAfter,
              validBefore,
              fromNonce,
              signature
            )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorAuthEarly"
        );
      });

      it("should revert if the signature's validBefore has been exceeded", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const validAfter = BigNumber.from(0);
        const validBefore = validAfter;
        const fromNonce = ethers.BigNumber.from(
          ethers.utils.randomBytes(32)
        )._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.RECEIVE_WITH_AUTHORIZATION,
          {
            from: initialHolder.address,
            to: spender.address,
            value: DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce: fromNonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          initialHolder
        );

        await expect(
          erc20Bridged
            .connect(spender)
            [
              "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
            ](
              initialHolder.address,
              spender.address,
              DEFAULT_AMOUNT,
              validAfter,
              validBefore,
              fromNonce,
              signature
            )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorAuthExpired"
        );
      });

      it("should revert if the nonce has already been used", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const { nonce, validAfter, validBefore, signature } =
          await validReceiveWithAuthorization(
            initialHolder,
            spender,
            erc20Bridged,
            domain,
            DEFAULT_AMOUNT
          );

        await expect(
          erc20Bridged
            .connect(spender)
            [
              "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
            ](
              initialHolder.address,
              spender.address,
              DEFAULT_AMOUNT,
              validAfter,
              validBefore,
              nonce,
              signature
            )
        )
          .to.be.revertedWithCustomError(
            erc20Bridged,
            "EIP3009Upgradeable__ErrorNonceAlreadyUsed"
          )
          .withArgs(nonce);
      });

      it("should revert if the signature has been signed by someone else other than the owner", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const validAfter = 0;
        const validBefore = ethers.constants.MaxUint256;
        const fromNonce = ethers.BigNumber.from(
          ethers.utils.randomBytes(32)
        )._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.RECEIVE_WITH_AUTHORIZATION,
          {
            from: initialHolder.address,
            to: spender.address,
            value: DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce: fromNonce,
          }
        );
        const signature = await signTypedData(domain, type, data, spender);

        await expect(
          erc20Bridged
            .connect(spender)
            [
              "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
            ](
              initialHolder.address,
              spender.address,
              DEFAULT_AMOUNT,
              validAfter,
              validBefore,
              fromNonce,
              signature
            )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorInvalidSignature"
        );
      });

      it(">>> works as expected (using r,s,v)", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        assert.isTrue(
          (await erc20Bridged.balanceOf(spender.address)).eq(BigNumber.from(0))
        );

        const validAfter = BigNumber.from(0);
        const validBefore = ethers.constants.MaxUint256;
        const fromNonce = ethers.BigNumber.from(
          ethers.utils.randomBytes(32)
        )._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.RECEIVE_WITH_AUTHORIZATION,
          {
            from: initialHolder.address,
            to: spender.address,
            value: DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce: fromNonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          initialHolder
        );

        const r = signature.slice(0, 66);
        const s = "0x" + signature.slice(66, 130);
        const v = "0x" + signature.slice(130, 132);

        const transferTx = await erc20Bridged
          .connect(spender)
          [
            "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)"
          ](
            initialHolder.address,
            spender.address,
            DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            fromNonce,
            v,
            r,
            s
          );

        expect(transferTx)
          .to.emit(erc20Bridged, "EIP3009Upgradeable__AuthorizationUsed")
          .withArgs(initialHolder.address, fromNonce)
          .to.emit(erc20Bridged, "Transfer")
          .withArgs(initialHolder.address, spender.address, DEFAULT_AMOUNT);

        await transferTx.wait();

        assert.isTrue(
          (await erc20Bridged.balanceOf(spender.address)).eq(DEFAULT_AMOUNT),
          "Incorrect spender balance"
        );
      });

      it(">>> works as expected (using full signature)", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        assert.isTrue(
          (await erc20Bridged.balanceOf(spender.address)).eq(BigNumber.from(0))
        );

        await validTransferWithAuthorization(
          initialHolder,
          spender,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT
        );

        assert.isTrue(
          (await erc20Bridged.balanceOf(spender.address)).eq(DEFAULT_AMOUNT),
          "Incorrect spender balance"
        );
      });
    });

    describe("*** ERC1271Wallet ***", async () => {
      it("should revert if the receiver is not sending the transaction", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const validAfter = 0;
        const validBefore = ethers.constants.MaxUint256;
        const fromNonce = ethers.BigNumber.from(
          ethers.utils.randomBytes(32)
        )._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.RECEIVE_WITH_AUTHORIZATION,
          {
            from: erc1271Wallet.address,
            to: spender.address,
            value: DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce: fromNonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          erc1271WalletOwner
        );

        await expect(
          erc20Bridged[
            "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
          ](
            erc1271Wallet.address,
            spender.address,
            DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            fromNonce,
            signature
          )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorUnauthorized"
        );
      });

      it("should revert if the signature's validAfter hasn't been reached", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const validAfter = ethers.constants.MaxUint256;
        const validBefore = ethers.constants.MaxUint256;
        const fromNonce = ethers.BigNumber.from(
          ethers.utils.randomBytes(32)
        )._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.RECEIVE_WITH_AUTHORIZATION,
          {
            from: erc1271Wallet.address,
            to: spender.address,
            value: DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce: fromNonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          erc1271WalletOwner
        );

        await expect(
          erc20Bridged
            .connect(spender)
            [
              "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
            ](
              erc1271Wallet.address,
              spender.address,
              DEFAULT_AMOUNT,
              validAfter,
              validBefore,
              fromNonce,
              signature
            )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorAuthEarly"
        );
      });

      it("should revert if the signature's validBefore has been exceeded", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const validAfter = BigNumber.from(0);
        const validBefore = validAfter;
        const fromNonce = ethers.BigNumber.from(
          ethers.utils.randomBytes(32)
        )._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.RECEIVE_WITH_AUTHORIZATION,
          {
            from: erc1271Wallet.address,
            to: spender.address,
            value: DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce: fromNonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          erc1271WalletOwner
        );

        await expect(
          erc20Bridged
            .connect(spender)
            [
              "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
            ](
              erc1271Wallet.address,
              spender.address,
              DEFAULT_AMOUNT,
              validAfter,
              validBefore,
              fromNonce,
              signature
            )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorAuthExpired"
        );
      });

      it("should revert if the nonce has already been used", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const { nonce, validAfter, validBefore, signature } =
          await validReceiveWithAuthorization(
            erc1271WalletOwner,
            spender,
            erc20Bridged,
            domain,
            DEFAULT_AMOUNT,
            {
              erc1271WalletContract: erc1271Wallet.address,
            }
          );

        await expect(
          erc20Bridged
            .connect(spender)
            [
              "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
            ](
              erc1271Wallet.address,
              spender.address,
              DEFAULT_AMOUNT,
              validAfter,
              validBefore,
              nonce,
              signature
            )
        )
          .to.be.revertedWithCustomError(
            erc20Bridged,
            "EIP3009Upgradeable__ErrorNonceAlreadyUsed"
          )
          .withArgs(nonce);
      });

      it("should revert if the signature has been signed by someone else other than the owner", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const validAfter = 0;
        const validBefore = ethers.constants.MaxUint256;
        const fromNonce = ethers.BigNumber.from(
          ethers.utils.randomBytes(32)
        )._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.RECEIVE_WITH_AUTHORIZATION,
          {
            from: erc1271Wallet.address,
            to: spender.address,
            value: DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce: fromNonce,
          }
        );
        const signature = await signTypedData(domain, type, data, spender);

        await expect(
          erc20Bridged
            .connect(spender)
            [
              "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
            ](
              erc1271Wallet.address,
              spender.address,
              DEFAULT_AMOUNT,
              validAfter,
              validBefore,
              fromNonce,
              signature
            )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorInvalidSignature"
        );
      });

      it(">>> works as expected (using r,s,v)", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        assert.isTrue(
          (await erc20Bridged.balanceOf(spender.address)).eq(BigNumber.from(0))
        );

        const validAfter = BigNumber.from(0);
        const validBefore = ethers.constants.MaxUint256;
        const fromNonce = ethers.BigNumber.from(
          ethers.utils.randomBytes(32)
        )._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.RECEIVE_WITH_AUTHORIZATION,
          {
            from: erc1271Wallet.address,
            to: spender.address,
            value: DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            nonce: fromNonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          erc1271WalletOwner
        );

        const r = signature.slice(0, 66);
        const s = "0x" + signature.slice(66, 130);
        const v = "0x" + signature.slice(130, 132);

        const transferTx = await erc20Bridged
          .connect(spender)
          [
            "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)"
          ](
            erc1271Wallet.address,
            spender.address,
            DEFAULT_AMOUNT,
            validAfter,
            validBefore,
            fromNonce,
            v,
            r,
            s
          );

        expect(transferTx)
          .to.emit(erc20Bridged, "EIP3009Upgradeable__AuthorizationUsed")
          .withArgs(erc1271Wallet.address, fromNonce)
          .to.emit(erc20Bridged, "Transfer")
          .withArgs(erc1271Wallet.address, spender.address, DEFAULT_AMOUNT);

        await transferTx.wait();

        assert.isTrue(
          (await erc20Bridged.balanceOf(spender.address)).eq(DEFAULT_AMOUNT),
          "Incorrect spender balance"
        );
      });

      it(">>> works as expected (using full signature)", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        assert.isTrue(
          (await erc20Bridged.balanceOf(spender.address)).eq(BigNumber.from(0))
        );

        await validTransferWithAuthorization(
          erc1271WalletOwner,
          spender,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
          {
            erc1271WalletContract: erc1271Wallet.address,
          }
        );

        assert.isTrue(
          (await erc20Bridged.balanceOf(spender.address)).eq(DEFAULT_AMOUNT),
          "Incorrect spender balance"
        );
      });
    });
  });

  describe("=== Cancel with Authorization ===", async () => {
    describe("*** EOA ***", async () => {
      it("should revert if the nonce has already been used", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const { nonce } = await validTransferWithAuthorization(
          initialHolder,
          spender,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT
        );

        const { type, data } = getEIP712Operation(
          EIP712Operations.CANCEL_AUTHORIZATION,
          {
            authorizer: initialHolder.address,
            nonce: nonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          initialHolder
        );

        await expect(
          erc20Bridged
            .connect(spender)
            ["cancelAuthorization(address,bytes32,bytes)"](
              initialHolder.address,
              nonce,
              signature
            )
        )
          .to.be.revertedWithCustomError(
            erc20Bridged,
            "EIP3009Upgradeable__ErrorNonceAlreadyUsed"
          )
          .withArgs(nonce);
      });

      it("should revert if the signature has been singed by someone other than the owner", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
        } = context;

        const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32))._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.CANCEL_AUTHORIZATION,
          {
            authorizer: initialHolder.address,
            nonce: nonce,
          }
        );
        const signature = await signTypedData(domain, type, data, spender);

        await expect(
          erc20Bridged
            .connect(spender)
            ["cancelAuthorization(address,bytes32,bytes)"](
              initialHolder.address,
              nonce,
              signature
            )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorInvalidSignature"
        );
      });

      it(">>> works as expected (using r,s,v)", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
        } = context;

        const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32))._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.CANCEL_AUTHORIZATION,
          {
            authorizer: initialHolder.address,
            nonce: nonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          initialHolder
        );

        const r = signature.slice(0, 66);
        const s = "0x" + signature.slice(66, 130);
        const v = "0x" + signature.slice(130, 132);

        await expect(
          erc20Bridged
            .connect(spender)
            ["cancelAuthorization(address,bytes32,uint8,bytes32,bytes32)"](
              initialHolder.address,
              nonce,
              v,
              r,
              s
            )
        )
          .to.emit(erc20Bridged, "EIP3009Upgradeable__AuthorizationCanceled")
          .withArgs(initialHolder.address, nonce);
      });

      it(">>> works as expected (using full signature)", async () => {
        const {
          accounts: { initialHolder, spender },
          erc20Bridged,
          domain,
        } = context;

        const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32))._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.CANCEL_AUTHORIZATION,
          {
            authorizer: initialHolder.address,
            nonce: nonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          initialHolder
        );

        await expect(
          erc20Bridged
            .connect(spender)
            ["cancelAuthorization(address,bytes32,bytes)"](
              initialHolder.address,
              nonce,
              signature
            )
        )
          .to.emit(erc20Bridged, "EIP3009Upgradeable__AuthorizationCanceled")
          .withArgs(initialHolder.address, nonce);
      });
    });

    describe("*** ERC1271Wallet ***", async () => {
      it("should revert if the nonce has already been used", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
        } = context;

        const { nonce } = await validTransferWithAuthorization(
          erc1271WalletOwner,
          spender,
          erc20Bridged,
          domain,
          DEFAULT_AMOUNT,
          {
            erc1271WalletContract: erc1271Wallet.address,
          }
        );

        const { type, data } = getEIP712Operation(
          EIP712Operations.CANCEL_AUTHORIZATION,
          {
            authorizer: erc1271Wallet.address,
            nonce: nonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          erc1271WalletOwner
        );

        await expect(
          erc20Bridged
            .connect(spender)
            ["cancelAuthorization(address,bytes32,bytes)"](
              erc1271Wallet.address,
              nonce,
              signature
            )
        )
          .to.be.revertedWithCustomError(
            erc20Bridged,
            "EIP3009Upgradeable__ErrorNonceAlreadyUsed"
          )
          .withArgs(nonce);
      });

      it("should revert if the signature has been singed by someone other than the owner", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
        } = context;

        const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32))._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.CANCEL_AUTHORIZATION,
          {
            authorizer: erc1271Wallet.address,
            nonce: nonce,
          }
        );
        const signature = await signTypedData(domain, type, data, spender);

        await expect(
          erc20Bridged
            .connect(spender)
            ["cancelAuthorization(address,bytes32,bytes)"](
              erc1271Wallet.address,
              nonce,
              signature
            )
        ).to.be.revertedWithCustomError(
          erc20Bridged,
          "EIP3009Upgradeable__ErrorInvalidSignature"
        );
      });

      it(">>> works as expected (using r,s,v)", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
        } = context;

        const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32))._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.CANCEL_AUTHORIZATION,
          {
            authorizer: erc1271Wallet.address,
            nonce: nonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          erc1271WalletOwner
        );

        const r = signature.slice(0, 66);
        const s = "0x" + signature.slice(66, 130);
        const v = "0x" + signature.slice(130, 132);

        await expect(
          erc20Bridged
            .connect(spender)
            ["cancelAuthorization(address,bytes32,uint8,bytes32,bytes32)"](
              erc1271Wallet.address,
              nonce,
              v,
              r,
              s
            )
        )
          .to.emit(erc20Bridged, "EIP3009Upgradeable__AuthorizationCanceled")
          .withArgs(erc1271Wallet.address, nonce);
      });

      it(">>> works as expected (using full signature)", async () => {
        const {
          accounts: { erc1271WalletOwner, spender },
          erc1271Wallet,
          erc20Bridged,
          domain,
        } = context;

        const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32))._hex;

        const { type, data } = getEIP712Operation(
          EIP712Operations.CANCEL_AUTHORIZATION,
          {
            authorizer: erc1271Wallet.address,
            nonce: nonce,
          }
        );
        const signature = await signTypedData(
          domain,
          type,
          data,
          erc1271WalletOwner
        );

        await expect(
          erc20Bridged
            .connect(spender)
            ["cancelAuthorization(address,bytes32,bytes)"](
              erc1271Wallet.address,
              nonce,
              signature
            )
        )
          .to.emit(erc20Bridged, "EIP3009Upgradeable__AuthorizationCanceled")
          .withArgs(erc1271Wallet.address, nonce);
      });
    });
  });
});

const addToBlockedList = async (
  erc20: ethers.Contract,
  admin: Wallet,
  toBlocklist: Wallet
) => {
  const blockTx = await erc20
    .connect(admin)
    .addToBlockedList(toBlocklist.address);

  expect(blockTx).to.emit(erc20, "BlockPlaced").withArgs(toBlocklist);

  await blockTx.wait();

  assert.deepEqual(
    await erc20.isBlocked(toBlocklist.address),
    true,
    "Address was not added to the blocklist"
  );
};

const removeFromBlockedList = async (
  erc20: ethers.Contract,
  admin: Wallet,
  toRemoveFromBlocklist: Wallet
) => {
  const unblockTx = await erc20
    .connect(admin)
    .removeFromBlockedList(toRemoveFromBlocklist.address);

  expect(unblockTx)
    .to.emit(erc20, "BlockReleased")
    .withArgs(toRemoveFromBlocklist);

  await unblockTx.wait();

  assert.deepEqual(
    await erc20.isBlocked(toRemoveFromBlocklist.address),
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

  const balance = await erc20.balanceOf(toDestroy.address);

  const destroyTx = await erc20
    .connect(admin)
    .destroyBlockedFunds(toDestroy.address);

  expect(destroyTx)
    .to.emit(erc20, "DestroyedBlockedFunds")
    .withArgs(toDestroy.address, balance);

  await destroyTx.wait();

  assert.isTrue(
    (await erc20.balanceOf(toDestroy.address)).eq(0),
    "Tokens were not destroyed"
  );
};

const validPermit = async (
  owner: Wallet,
  spender: Wallet,
  erc20Bridged: TetherZkSync,
  domain: any,
  opts?: {
    customDeadline?: BigNumber;
    erc1271WalletContract?: string;
  }
) => {
  const ownerAddr = opts
    ? opts.erc1271WalletContract || owner.address
    : owner.address;
  const spenderAddr = spender.address;
  const amount = ethers.utils.parseEther("1");
  const ownerNonce = await erc20Bridged.nonces(ownerAddr);
  const deadline = opts
    ? opts.customDeadline || ethers.constants.MaxUint256
    : ethers.constants.MaxInt256;

  const { type, data } = getEIP712Operation(EIP712Operations.PERMIT, {
    owner: ownerAddr,
    spender: spenderAddr,
    value: amount,
    nonce: ownerNonce,
    deadline: deadline,
  });
  const signature = await signTypedData(domain, type, data, owner);

  const permitTx = await erc20Bridged[
    "permit(address,address,uint256,uint256,bytes)"
  ](ownerAddr, spenderAddr, amount, deadline, signature);

  expect(permitTx)
    .to.emit(erc20Bridged, "Approval")
    .withArgs(ownerAddr, spenderAddr, amount);

  await permitTx.wait();

  return {
    owner,
    spender,
    value: amount,
    nonce: ownerNonce,
    deadline,
    signature,
  };
};

const validTransferWithAuthorization = async (
  from: Wallet,
  to: Wallet,
  erc20Bridged: TetherZkSync,
  domain: any,
  amount: BigNumber,
  opts?: {
    validAfter?: BigNumber;
    validBefore?: BigNumber;
    erc1271WalletContract?: string;
  }
) => {
  const fromAddr = opts
    ? opts.erc1271WalletContract || from.address
    : from.address;
  const toAddr = to.address;
  const fromNonce = ethers.BigNumber.from(ethers.utils.randomBytes(32))._hex;
  const validAfter = opts
    ? opts.validAfter || BigNumber.from(0)
    : BigNumber.from(0);
  const validBefore = opts
    ? opts.validBefore || ethers.constants.MaxUint256
    : ethers.constants.MaxUint256;

  const { type, data } = getEIP712Operation(
    EIP712Operations.TRANSFER_WITH_AUTHORIZATION,
    {
      from: fromAddr,
      to: toAddr,
      value: amount,
      validAfter,
      validBefore,
      nonce: fromNonce,
    }
  );
  const signature = await signTypedData(domain, type, data, from);

  const transferTx = await erc20Bridged[
    "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
  ](fromAddr, toAddr, amount, validAfter, validBefore, fromNonce, signature);

  expect(transferTx)
    .to.emit(erc20Bridged, "EIP3009Upgradeable__AuthorizationUsed")
    .withArgs(from.address, fromNonce)
    .to.emit(erc20Bridged, "Transfer")
    .withArgs(from.address, to.address, amount);

  await transferTx.wait();

  return {
    from,
    to,
    value: amount,
    nonce: fromNonce,
    validAfter,
    validBefore,
    signature,
  };
};

const validReceiveWithAuthorization = async (
  from: Wallet,
  to: Wallet,
  erc20Bridged: TetherZkSync,
  domain: any,
  amount: BigNumber,
  opts?: {
    validAfter?: BigNumber;
    validBefore?: BigNumber;
    erc1271WalletContract?: string;
  }
) => {
  const fromAddr = opts
    ? opts.erc1271WalletContract || from.address
    : from.address;
  const toAddr = to.address;
  const fromNonce = ethers.BigNumber.from(ethers.utils.randomBytes(32))._hex;
  const validAfter = opts
    ? opts.validAfter || BigNumber.from(0)
    : BigNumber.from(0);
  const validBefore = opts
    ? opts.validBefore || ethers.constants.MaxUint256
    : ethers.constants.MaxUint256;

  const { type, data } = getEIP712Operation(
    EIP712Operations.RECEIVE_WITH_AUTHORIZATION,
    {
      from: fromAddr,
      to: toAddr,
      value: amount,
      validAfter,
      validBefore,
      nonce: fromNonce,
    }
  );
  const signature = await signTypedData(domain, type, data, from);

  const receiveTx = await erc20Bridged
    .connect(to)
    [
      "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
    ](fromAddr, toAddr, amount, validAfter, validBefore, fromNonce, signature);

  expect(receiveTx)
    .to.emit(erc20Bridged, "EIP3009Upgradeable__AuthorizationUsed")
    .withArgs(from.address, fromNonce)
    .to.emit(erc20Bridged, "Transfer")
    .withArgs(from.address, to.address, amount);

  await receiveTx.wait();

  return {
    from,
    to,
    value: amount,
    nonce: fromNonce,
    validAfter,
    validBefore,
    signature,
  };
};

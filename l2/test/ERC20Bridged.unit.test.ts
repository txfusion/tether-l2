import { assert, expect } from "chai";
import { ethers, BigNumber } from "ethers";
import { describe } from "mocha";

import { domainSeparator } from "./utils/eip712";
import {
  CHAIN_ID,
  L2_TOKEN_NAME,
  L2_TOKEN_SINGING_DOMAIN_VERSION,
} from "./utils/constants";
import { setup } from "./utils/erc20.setup";

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

import { describe } from "mocha";
import { assert, expect } from "chai";

import { setup } from "./../setup/bridge.setup";

describe("~~~ Bridge E2E testing", async () => {
  let ctx: Awaited<ReturnType<typeof setup>>;

  before("Setting up the context", async () => {
    ctx = await setup();
  });

  it("> Validate L1 & L2 Bridges are initiated properly", async () => {
    const {
      l1: { l1Bridge, l1Token },
      l2: { l2Bridge, l2Token },
    } = ctx;

    assert((await l1Bridge.l1Token()) === l1Token.address);
    assert((await l1Bridge.l2Token()) === l2Token.address);
    assert((await l1Bridge.l2Bridge()) === l2Bridge.address);
    assert.isTrue(await l1Bridge.isInitialized());

    assert((await l2Bridge.l1Token()) === l1Token.address);
    assert((await l2Bridge.l2Token()) === l2Token.address);
    assert((await l2Bridge.l1Bridge()) === l1Bridge.address);
    assert.isTrue(await l2Bridge.isInitialized());
  });

  it("> Validate tester has required amount of L1 token", async () => {
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

    const l1BridgeAllowanceAfter = await l1Token.allowance(
      deployer.address,
      l1Bridge.address
    );

    expect(
      l1BridgeAllowanceAfter.eq(depositAmount),
      `Value ${l1BridgeAllowanceAfter.toString()} is not equal to ${depositAmount.toString()}`
    );
  });
});

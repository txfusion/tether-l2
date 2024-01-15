import { describe } from "mocha";
import { assert, expect } from "chai";

import { setup } from "./bridge.setup";

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

  //   it("> L1 Agent can disable/enable deposits on L1 & L2 bridges", async () => {
  //     const {
  //       l1: {
  //         l1Bridge,
  //         accounts: { deployer },
  //       },
  //       l2: { l2Bridge },
  //     } = ctx;

  //     /**
  //      * L1
  //      */
  //     if (await l1Bridge.isDepositsEnabled()) {
  //       await executeGovOnL1Bridge(
  //         l1Bridge,
  //         agent,
  //         BRIDGE_ACTIONS.disableDeposits
  //       );
  //       assert.isFalse(await l1Bridge.isDepositsEnabled());
  //     }

  //     if (!(await l1Bridge.isDepositsEnabled())) {
  //       await executeGovOnL1Bridge(
  //         l1Bridge,
  //         agent,
  //         BRIDGE_ACTIONS.enableDeposits
  //       );
  //       assert.isTrue(await l1Bridge.isDepositsEnabled());
  //     }
  //     /**
  //      * L2
  //      */
  //     if (await l2Bridge.isDepositsEnabled()) {
  //       await executeGovOnL2Bridge(
  //         l2Bridge,
  //         agent,
  //         BRIDGE_ACTIONS.disableDeposits,
  //         ctx
  //       );
  //       assert.isFalse(
  //         await l2Bridge.isDepositsEnabled(),
  //         "Deposits should be disabled"
  //       );
  //     }
  //     if (!(await l2Bridge.isDepositsEnabled())) {
  //       await executeGovOnL2Bridge(
  //         l2Bridge,
  //         agent,
  //         BRIDGE_ACTIONS.enableDeposits,
  //         ctx
  //       );
  //       assert.isTrue(
  //         await l2Bridge.isDepositsEnabled(),
  //         "Deposits should be enabled"
  //       );
  //     }
  //   });

  //   it("> L1 Agent can disable/enable withdrawals on L1 & L2 bridges", async () => {
  //     const {
  //       l1: {
  //         l1Bridge,
  //         accounts: { deployer },
  //       },
  //       l2: { l2Bridge },
  //     } = ctx;

  //     /**
  //      * L1
  //      */
  //     if (await l1Bridge.isWithdrawalsEnabled()) {
  //       await executeGovOnL1Bridge(
  //         l1Bridge,
  //         agent,
  //         BRIDGE_ACTIONS.disableWithdrawals
  //       );

  //       assert.isFalse(
  //         await l1Bridge.isWithdrawalsEnabled(),
  //         "L1 Withdrawals should be disabled"
  //       );
  //     }

  //     if (!(await l1Bridge.isWithdrawalsEnabled())) {
  //       await executeGovOnL1Bridge(
  //         l1Bridge,
  //         agent,
  //         BRIDGE_ACTIONS.enableWithdrawals
  //       );
  //       assert.isTrue(
  //         await l1Bridge.isWithdrawalsEnabled(),
  //         "L1 Withdrawals should be enabled"
  //       );
  //     }

  //     /**
  //      * L2
  //      */
  //     if (await l2Bridge.isWithdrawalsEnabled()) {
  //       await executeGovOnL2Bridge(
  //         l2Bridge,
  //         agent,
  //         BRIDGE_ACTIONS.disableWithdrawals,
  //         ctx
  //       );
  //       assert.isFalse(
  //         await l2Bridge.isWithdrawalsEnabled(),
  //         "Withdrawals should be disabled"
  //       );
  //     }

  //     if (!(await l2Bridge.isWithdrawalsEnabled())) {
  //       await executeGovOnL2Bridge(
  //         l2Bridge,
  //         agent,
  //         BRIDGE_ACTIONS.enableWithdrawals,
  //         ctx
  //       );
  //       assert.isTrue(
  //         await l2Bridge.isWithdrawalsEnabled(),
  //         "Withdrawals should be enabled"
  //       );
  //     }
  //   });

  //   it("> Deposit tokens to L2 via L1ERC20Bridge", async () => {
  //     const {
  //       l1: { l1Token, l1Bridge, accounts },
  //       l2: { l2Bridge, l2Token },
  //       depositAmount,
  //       zkProvider,
  //       ethProvider,
  //       gasLimit,
  //     } = ctx;

  //     const walletAddress = accounts.deployer.address;

  //     const zkWallet = new ZkWallet(
  //       richWallet[0].privateKey,
  //       zkProvider,
  //       ethProvider
  //     );

  //     assert.isTrue(
  //       await l1Bridge.isDepositsEnabled(),
  //       "L1 Deposits should be enabled"
  //     );
  //     assert.isTrue(
  //       await l2Bridge.isDepositsEnabled(),
  //       "L2 Deposits should be enabled"
  //     );

  //     const l2Token_TotalSupply_Before = await l2Token.totalSupply();
  //     const l1ERC20Bridge_TokenBalance_Before = await l1Token.balanceOf(
  //       l1Bridge.address
  //     );
  //     const l1Token_UserBalance_Before = await l1Token.balanceOf(walletAddress);
  //     const l2Token_UserBalance_Before = await l2Token.balanceOf(walletAddress);

  //     const depositTx = await l1Bridge.populateTransaction[
  //       "deposit(address,address,uint256,uint256,uint256,address)"
  //     ](
  //       walletAddress,
  //       l1Token.address,
  //       depositAmount,
  //       BigNumber.from(10_000_000),
  //       utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
  //       walletAddress
  //     );

  //     // call to RPC method zks_estimateGasL1ToL2 to estimate L2 gas limit
  //     const l2GasLimit = await zkProvider.estimateGasL1(depositTx);
  //     const l2GasPrice = await zkProvider.getGasPrice();

  //     const baseCost = await zkWallet.getBaseCost({
  //       gasLimit: l2GasLimit,
  //       gasPrice: l2GasPrice,
  //       gasPerPubdataByte: utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
  //     });

  //     const depositResponse = await l1Bridge[
  //       "deposit(address,address,uint256,uint256,uint256,address)"
  //     ](
  //       walletAddress,
  //       l1Token.address,
  //       depositAmount,
  //       l2GasLimit,
  //       utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
  //       walletAddress,
  //       {
  //         gasLimit,
  //         value: baseCost,
  //       }
  //     );

  //     await depositResponse.wait();

  //     const l2Response = await zkProvider.getL2TransactionFromPriorityOp(
  //       depositResponse
  //     );
  //     await l2Response.wait();

  //     const l2Token_TotalSupply_After = await l2Token.totalSupply();
  //     const l1ERC20Bridge_TokenBalance_After = await l1Token.balanceOf(
  //       l1Bridge.address
  //     );

  //     const l1Token_UserBalance_After = await l1Token.balanceOf(walletAddress);
  //     const l2Token_UserBalance_After = await l2Token.balanceOf(walletAddress);

  //     const l1Token_TotalSupply_Difference = l1ERC20Bridge_TokenBalance_After.sub(
  //       l1ERC20Bridge_TokenBalance_Before
  //     );
  //     const l2Token_TotalSupply_Difference = l2Token_TotalSupply_After.sub(
  //       l2Token_TotalSupply_Before
  //     );
  //     const l1Token_UserBalance_Difference = l1Token_UserBalance_Before.sub(
  //       l1Token_UserBalance_After
  //     );
  //     const l2Token_UserBalance_Difference = l2Token_UserBalance_After.sub(
  //       l2Token_UserBalance_Before
  //     );

  //     // total supply of L2 token should increase
  //     expect(
  //       l2Token_TotalSupply_Difference.eq(depositAmount),
  //       `Value ${l2Token_TotalSupply_Difference.toString()} is not equal to ${depositAmount.toString()}`
  //     );

  //     // L1 token balance owned by bridge should increase
  //     expect(
  //       l1Token_TotalSupply_Difference.eq(depositAmount),
  //       `Value ${l1Token_TotalSupply_Difference.toString()} is not equal to ${depositAmount.toString()}`
  //     );

  //     // L1 token balance owned by user should decrease
  //     expect(
  //       l1Token_UserBalance_Difference.eq(depositAmount),
  //       `Value ${l1Token_TotalSupply_Difference.toString()} is not equal to ${depositAmount.toString()}`
  //     );

  //     // L2 token balance owned by user should increase
  //     expect(
  //       l2Token_UserBalance_Difference.eq(depositAmount),
  //       `Value ${l1Token_TotalSupply_Difference.toString()} is not equal to ${depositAmount.toString()}`
  //     );
  //   });

  //   it("> Withdraw tokens from L2 via L2ERC20Bridge", async () => {
  //     const {
  //       l1: { l1Token, l1Bridge, accounts },
  //       l2: { l2Token, l2Bridge },
  //       withdrawalAmount,
  //       gasLimit,
  //       zkProvider,
  //     } = ctx;

  //     const walletAddress = accounts.deployer.address;
  //     const IL1Bridge = L1ERC20Bridge__factory.createInterface();

  //     assert.isTrue(
  //       await l1Bridge.isWithdrawalsEnabled(),
  //       "L1 Withdrawals should be enabled"
  //     );

  //     assert.isTrue(
  //       await l2Bridge.isWithdrawalsEnabled(),
  //       "L2 Withdrawals should be enabled"
  //     );

  //     // before
  //     const l1ERC20Bridge_TokenBalance_Before = await l1Token.balanceOf(
  //       l1Bridge.address
  //     );
  //     const l2Token_TotalSupply_Before = await l2Token.totalSupply();
  //     const l1Token_UserBalance_Before = await l1Token.balanceOf(walletAddress);
  //     const l2Token_UserBalance_Before = await l2Token.balanceOf(walletAddress);

  //     const withdrawResponse = await l2Bridge.withdraw(
  //       walletAddress,
  //       l2Token.address,
  //       withdrawalAmount,
  //       { gasLimit }
  //     );

  //     await withdrawResponse.wait();
  //     const { blockNumber, l1BatchNumber, l1BatchTxIndex } =
  //       await withdrawResponse.waitFinalize();

  //     // Finalize Withdrawal on L1
  //     const message = solidityPack(
  //       ["bytes4", "address", "address", "uint256"],
  //       [
  //         IL1Bridge.getSighash(IL1Bridge.getFunction("finalizeWithdrawal")),
  //         walletAddress,
  //         l1Token.address,
  //         withdrawalAmount,
  //       ]
  //     );

  //     const messageProof = await zkProvider.getMessageProof(
  //       blockNumber,
  //       l2Bridge.address,
  //       keccak256(message)
  //     );

  //     const finalizeWithdrawResponse = await l1Bridge.finalizeWithdrawal(
  //       l1BatchNumber,
  //       messageProof?.id,
  //       l1BatchTxIndex,
  //       message,
  //       messageProof?.proof,
  //       { gasLimit }
  //     );

  //     await finalizeWithdrawResponse.wait();

  //     // after
  //     const l2Token_TotalSupply_After = await l2Token.totalSupply();
  //     const l1ERC20Bridge_TokenBalance_After = await l1Token.balanceOf(
  //       l1Bridge.address
  //     );

  //     const l1Token_UserBalance_After = await l1Token.balanceOf(walletAddress);
  //     const l2Token_UserBalance_After = await l2Token.balanceOf(walletAddress);

  //     // diffs
  //     const l1Token_TotalSupply_Difference = l2Token_TotalSupply_Before.sub(
  //       l2Token_TotalSupply_After
  //     );
  //     const l1ERC20BridgeTokenBalanceDifference =
  //       l1ERC20Bridge_TokenBalance_Before.sub(l1ERC20Bridge_TokenBalance_After);

  //     const l1Token_UserBalance_Difference = l1Token_UserBalance_After.sub(
  //       l1Token_UserBalance_Before
  //     );
  //     const l2Token_UserBalance_Difference = l2Token_UserBalance_Before.sub(
  //       l2Token_UserBalance_After
  //     );

  //     // total supply of L2 token should decrease
  //     expect(
  //       l1Token_TotalSupply_Difference.eq(withdrawalAmount),
  //       `Value ${l1Token_TotalSupply_Difference.toString()} is not equal to ${withdrawalAmount.toString()}`
  //     );

  //     // L1 token balance owned by bridge should decrease
  //     expect(
  //       l1ERC20BridgeTokenBalanceDifference.eq(withdrawalAmount),
  //       `Value ${l1ERC20BridgeTokenBalanceDifference.toString()} is not equal to ${withdrawalAmount.toString()}`
  //     );

  //     // L1 token balance owned by user should increase
  //     expect(
  //       l1Token_UserBalance_Difference.eq(withdrawalAmount),
  //       `Value ${l1Token_UserBalance_Difference.toString()} is not equal to ${withdrawalAmount.toString()}`
  //     );

  //     // L2 token balance owned by user should decrease
  //     expect(
  //       l2Token_UserBalance_Difference.eq(withdrawalAmount),
  //       `Value ${l2Token_UserBalance_Difference.toString()} is not equal to ${withdrawalAmount.toString()}`
  //     );
  //   });
});

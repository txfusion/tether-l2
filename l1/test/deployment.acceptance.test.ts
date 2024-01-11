// import { ethers } from "ethers";
// import { utils } from "zksync-web3";
// import { assert } from "chai";
// import { ProxyAdmin__factory } from "../../l2/typechain";

// import { HASHES } from "../scripts/utils/hashes";

// import { ERC20_BRIDGED_CONSTANTS } from "../../l2/scripts/utils/constants";
// import { defaultAbiCoder } from "ethers/lib/utils";
// import { setup } from "./utils/deployment.setup";

// describe("Tether on zkSync Era :: deployment acceptance test", async () => {
//   let ctx: Awaited<ReturnType<typeof setup>>;

//   before("Setting up the context", async () => {
//     ctx = await setup();
//   });

//   it("L1 Bridge :: proxy admin", async () => {
//     const {
//       l1: { proxy },
//       accounts: { l1Executor },
//     } = ctx;
//     assert.equal(await proxy.l1Bridge.proxy__getAdmin(), l1Executor);
//   });

//   it("L1 Bridge :: bridge admin", async () => {
//     const {
//       l1: { l1Bridge },
//     } = ctx;
//     assert.isTrue(
//       await l1Bridge.hasRole(
//         HASHES.ROLES.DEFAULT_ADMIN_ROLE,
//         ZKSYNC_ADDRESSES.l1.emergencyBrakeMultisig
//       )
//     );
//   });

//   it("L1 Bridge :: L1 Token", async () => {
//     const {
//       l1: { l1Bridge },
//     } = ctx;

//     assert.equal(await l1Bridge.l1Token(), ZKSYNC_ADDRESSES.l1.l1Token);
//   });

//   it("L1 Bridge :: L2 Token", async () => {
//     const {
//       l1: { l1Bridge },
//     } = ctx;

//     assert.equal(await l1Bridge.l2Token(), ZKSYNC_ADDRESSES.l2.l2Token);
//   });

//   it("L1 Bridge :: L2 Bridge", async () => {
//     const {
//       l1: { l1Bridge },
//     } = ctx;

//     assert.equal(await l1Bridge.l2Bridge(), ZKSYNC_ADDRESSES.l2.l2Bridge);
//   });

//   it("L1 Bridge :: is deposits disabled", async () => {
//     const {
//       l1: { l1Bridge },
//       depositsEnabled,
//     } = ctx;

//     assert.equal(await l1Bridge.isDepositsEnabled(), depositsEnabled.l1);
//   });

//   it("L1 Bridge :: is withdrawals enabled", async () => {
//     const {
//       l1: { l1Bridge },
//       withdrawalsEnabled,
//     } = ctx;

//     assert.equal(await l1Bridge.isWithdrawalsEnabled(), withdrawalsEnabled.l1);
//   });

//   it("L1 Bridge :: deposit enablers", async () => {
//     const {
//       l1: { l1Bridge },
//     } = ctx;

//     const enablerAddresses = [
//       ZKSYNC_ADDRESSES.l1.agent,
//       ZKSYNC_ADDRESSES.l1.emergencyBrakeMultisig,
//     ];

//     for (const enabler of enablerAddresses) {
//       assert.isTrue(
//         await l1Bridge.hasRole(HASHES.ROLES.DEPOSITS_ENABLER_ROLE, enabler)
//       );
//     }
//   });

//   it("L1 Bridge :: deposit disablers", async () => {
//     const {
//       l1: { l1Bridge },
//     } = ctx;

//     const disablerAddresses = [
//       ZKSYNC_ADDRESSES.l1.agent,
//       ZKSYNC_ADDRESSES.l1.emergencyBrakeMultisig,
//     ];

//     for (const disabler of disablerAddresses) {
//       assert.isTrue(
//         await l1Bridge.hasRole(HASHES.ROLES.DEPOSITS_DISABLER_ROLE, disabler)
//       );
//     }
//   });
//   it("L1 Bridge :: withdrawal enablers", async () => {
//     const {
//       l1: { l1Bridge },
//     } = ctx;

//     const enablerAddresses = [ZKSYNC_ADDRESSES.l1.agent];

//     for (const enabler of enablerAddresses) {
//       assert.isTrue(
//         await l1Bridge.hasRole(HASHES.ROLES.WITHDRAWALS_ENABLER_ROLE, enabler)
//       );
//     }
//   });

//   it("L1 Bridge :: withdrawal disablers", async () => {
//     const {
//       l1: { l1Bridge },
//     } = ctx;

//     const disablerAddresses = [
//       ZKSYNC_ADDRESSES.l1.agent,
//       ZKSYNC_ADDRESSES.l1.emergencyBrakeMultisig,
//     ];

//     for (const disabler of disablerAddresses) {
//       assert.isTrue(
//         await l1Bridge.hasRole(HASHES.ROLES.WITHDRAWALS_DISABLER_ROLE, disabler)
//       );
//     }
//   });

//   it("L1 Executor :: proxy admin", async () => {
//     const {
//       l1: {
//         proxy: { l1Executor },
//       },
//     } = ctx;

//     assert.equal(await l1Executor.proxy__getAdmin(), ZKSYNC_ADDRESSES.l1.agent);
//   });

//   it("L1 Executor :: owner", async () => {
//     const {
//       l1: { l1Executor },
//     } = ctx;

//     assert.equal(await l1Executor.owner(), ZKSYNC_ADDRESSES.l1.agent);
//   });

//   /**
//    *
//    * L2
//    *
//    */

//   it("L2 Bridge :: proxy admin", async () => {
//     const {
//       l2: { proxy },
//     } = ctx;
//     assert.equal(
//       await proxy.l2Bridge.proxy__getAdmin(),
//       ZKSYNC_ADDRESSES.l2.govExecutor
//     );
//   });

//   it("L2 Bridge :: bridge admin", async () => {
//     const {
//       l2: { l2Bridge },
//     } = ctx;
//     assert.isTrue(
//       await l2Bridge.hasRole(
//         HASHES.ROLES.DEFAULT_ADMIN_ROLE,
//         ZKSYNC_ADDRESSES.l2.govExecutor
//       )
//     );
//   });

//   it("L2 Bridge :: L1 Token", async () => {
//     const {
//       l2: { l2Bridge },
//     } = ctx;

//     assert.equal(await l2Bridge.l1Token(), ZKSYNC_ADDRESSES.l1.l1Token);
//   });

//   it("L2 Bridge :: L2 Token", async () => {
//     const {
//       l2: { l2Bridge },
//     } = ctx;

//     assert.equal(await l2Bridge.l2Token(), ZKSYNC_ADDRESSES.l2.l2Token);
//   });

//   it("L2 Bridge :: L1 Bridge", async () => {
//     const {
//       l2: { l2Bridge },
//     } = ctx;

//     assert.equal(await l2Bridge.l1Bridge(), ZKSYNC_ADDRESSES.l1.l1Bridge);
//   });

//   it("L2 Bridge :: is deposits disabled", async () => {
//     const {
//       l2: { l2Bridge },
//       depositsEnabled,
//     } = ctx;

//     assert.equal(await l2Bridge.isDepositsEnabled(), depositsEnabled.l2);
//   });

//   it("L2 Bridge :: is withdrawals enabled", async () => {
//     const {
//       l2: { l2Bridge },
//       withdrawalsEnabled,
//     } = ctx;

//     assert.equal(await l2Bridge.isWithdrawalsEnabled(), withdrawalsEnabled.l2);
//   });

//   it("L2 Bridge :: deposit enablers", async () => {
//     const {
//       l2: { l2Bridge },
//     } = ctx;

//     const enablerAddresses = [ZKSYNC_ADDRESSES.l2.govExecutor];

//     for (const enabler of enablerAddresses) {
//       assert.isTrue(
//         await l2Bridge.hasRole(HASHES.ROLES.DEPOSITS_ENABLER_ROLE, enabler)
//       );
//     }
//   });

//   it("L2 Bridge :: deposit disablers", async () => {
//     const {
//       l2: { l2Bridge },
//     } = ctx;

//     const disablerAddresses = [
//       ZKSYNC_ADDRESSES.l2.govExecutor,
//       ZKSYNC_ADDRESSES.l2.emergencyBrakeMultisig,
//     ];

//     for (const disabler of disablerAddresses) {
//       assert.isTrue(
//         await l2Bridge.hasRole(HASHES.ROLES.DEPOSITS_DISABLER_ROLE, disabler)
//       );
//     }
//   });
//   it("L2 Bridge :: withdrawal enablers", async () => {
//     const {
//       l1: { l1Bridge },
//     } = ctx;

//     const enablerAddresses = [ZKSYNC_ADDRESSES.l1.agent];

//     for (const enabler of enablerAddresses) {
//       assert.isTrue(
//         await l1Bridge.hasRole(HASHES.ROLES.WITHDRAWALS_ENABLER_ROLE, enabler)
//       );
//     }
//   });

//   it("L2 Bridge :: withdrawal disablers", async () => {
//     const {
//       l2: { l2Bridge },
//     } = ctx;

//     const disablerAddresses = [
//       ZKSYNC_ADDRESSES.l2.govExecutor,
//       ZKSYNC_ADDRESSES.l2.emergencyBrakeMultisig,
//     ];

//     for (const disabler of disablerAddresses) {
//       assert.isTrue(
//         await l2Bridge.hasRole(HASHES.ROLES.WITHDRAWALS_DISABLER_ROLE, disabler)
//       );
//     }
//   });

//   it("L2 Token :: proxy admin", async () => {
//     const {
//       l2: {
//         accounts: { deployer },
//       },
//       zkProvider,
//     } = ctx;

//     const proxyAdminAddressBytes32 = await zkProvider.getStorageAt(
//       ZKSYNC_ADDRESSES.l2.l2Token,
//       "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103" // storage where admin address is stored
//     ); // returns bytes32

//     const proxyAdminAddress = defaultAbiCoder.decode(
//       ["address"],
//       proxyAdminAddressBytes32
//     ); // returns Result => []

//     const proxyAdminContract = ProxyAdmin__factory.connect(
//       proxyAdminAddress[0], // proxyAdminAddress 0 index is the location of address
//       deployer
//     );

//     const L2TokenProxyAdminOwner = await proxyAdminContract.owner();

//     assert.equal(
//       L2TokenProxyAdminOwner,
//       ethers.utils.getAddress(
//         utils.applyL1ToL2Alias(ZKSYNC_ADDRESSES.l1.l1Executor)
//       )
//     );
//   });

//   it("L2 Token :: name", async () => {
//     assert.equal(await ctx.l2.l2Token.name(), ERC20_BRIDGED_CONSTANTS.NAME);
//   });

//   it("L2 Token :: symbol", async () => {
//     assert.equal(await ctx.l2.l2Token.symbol(), ERC20_BRIDGED_CONSTANTS.SYMBOL);
//   });

//   it("L2 Token :: decimals", async () => {
//     assert.equal(
//       await ctx.l2.l2Token.decimals(),
//       ERC20_BRIDGED_CONSTANTS.DECIMALS
//     );
//   });

//   it("L2 Token :: total supply", async () => {
//     assert.equal(
//       +ethers.utils.formatEther(await ctx.l2.l2Token.totalSupply()),
//       0
//     );
//   });

//   it("L2 token :: bridge", async () => {
//     assert.equal(await ctx.l2.l2Token.bridge(), ZKSYNC_ADDRESSES.l2.l2Bridge);
//   });

//   it("L2 Governance Executor :: proxy admin", async () => {
//     const {
//       l2: {
//         accounts: { deployer },
//       },
//       zkProvider,
//     } = ctx;

//     const proxyAdminAddressBytes32 = await zkProvider.getStorageAt(
//       ZKSYNC_ADDRESSES.l2.govExecutor,
//       "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"
//     ); // returns bytes32

//     const proxyAdminAddress = defaultAbiCoder.decode(
//       ["address"],
//       proxyAdminAddressBytes32
//     ); // returns Result => []

//     const proxyAdminContract = ProxyAdmin__factory.connect(
//       proxyAdminAddress[0], // proxyAdminAddress 0 index is the location of address
//       deployer
//     );

//     const L2TokenProxyAdminOwner = await proxyAdminContract.owner();

//     assert.equal(
//       L2TokenProxyAdminOwner,
//       ethers.utils.getAddress(
//         utils.applyL1ToL2Alias(ZKSYNC_ADDRESSES.l1.l1Executor)
//       )
//     );
//   });
// });

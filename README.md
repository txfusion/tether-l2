<p float="left">
   <img src="https://upload.wikimedia.org/wikipedia/commons/e/e9/Tether_USDT.png" width="75">
   &nbsp; &nbsp; &nbsp; 
   <img src="https://l2beat.com/icons/zksync-era.png" width="75">
</p>

# Tether on ZKsync

This repository features the infrastructure for bridging Tether USD from Ethereum to ZKsync Era and any other ZK chains built on top of the ZK stack, alongside with common bridge administration features, such as enabling/disabling deposits/withdrawals, and Tether's own blocklisting and destuction mechanisms of tokens owned by presumably evil actors in the system.

## ZK Chains

With a new shared bridge upgrade, users can bridge all their assets from a single L1 shared bridge to all registered ZK chains and their appropriate L2 shared bridge.

Therefore, with a single deployment of the L1 shared bridge on the Ethereum mainnet, we can deploy the L2 shared bridge counterpart to all registered networks (`1 + n` contracts), as opposed to a previous 2-bridges-per-network setup (`2 * n` contracts).

In case of Tether, due to things like custom L2 token logic and lack of action management on shared bridges (such as enabling/disabling deposits/withdraws), we've built a custom set of L1 and L2 shared bridges, which will accompany these features (more details below), and allow for bridging of the native USDT to all registered ZK chains.

## Setup

If you'd like to run a local version of this project, please do the following:

1. Run a `local-setup` for local development ([link](https://github.com/matter-labs/local-setup)) and wait for its setup to complete
2. Run `./compile.sh`
3. Set up the `.env` according to `.env.example`
4. Run `./deploy.sh`

From here, you can run `npm run test` to confirm that everything went smoothly, and then run `cd l1 && npm run test-deposit && npm run test-withdraw` to perform a simulation of the deposit + withdraw flow.

## Project Layout

This project consists of two folders: `l1` and `l2`. Both folders contain Hardhat projects and relevant dependencies for their chains. Some packages and contracts are shared between both projects, which can be found in the root folder.

## L1

### Contracts

The core of this subfolder is the custom `L1SharedBridge.sol` contract, that handles:

- **depositing assets to the shared bridge via Bridgehub**
- **claiming failed deposits** (via `claimFailedDeposit`, in case L2 side of things fail for any reason)
- **finalizing withdrawals** (via `finalizeWithdrawal`, in case user wants to go back to L1)

The `L1SharedBridge.sol` also extends the `BridgingManagerUpgradeable.sol` contract, that features enabling/disabling deposits/withdrawals on the L1, and `BridgeableTokensUpgradable.sol`, which makes sure that only the correct USDT token is allowed to be bridged through our bridge.

Since it is assumed that L1 already contains an `ERC20` token that should be bridged, all other contracts in this subfolder are mocks that are used in end-to-end testing in the local environment.

### Scripts

This subfolder also contains a few useful scripts for interaction with the administrative functions of the L1 bridge, such as: `enable-deposits`, `disable-deposits`, `enable-withdrawals` and `disable-withdrawals`.

These can be triggered only by the private key that has the appropriate roles, which are set in the `initialize-bridge-roles` script which is ran during the deployment of the bridge contract.

## L2

### Contracts

There are two core contracts: `L2SharedBridge.sol` and `TetherZKsync.sol`.

`L2SharedBridge.sol` is the `L1SharedBridge.sol`'s counterpart and it handles:

- **finalizing deposits** (via `finalizeDeposit`, to finally bridge L1 tokens to L2)
- **withdrawing funds from the bridge** (via `withdraw`, to initiate bridging of tokens over to L1)

The `L2SharedBridge.sol` also extends the `BridgingManagerUpgradeable.sol` contract, that features enabling/disabling deposits/withdrawals on the L2, and `BridgeableTokensUpgradable.sol`, which makes sure that only the native USDT token is allowed to be bridged through our bridge.

On L2, it is not assumed that there's an ERC20 token that's a counterpart to the L1 token, so there is a deployment-ready `TetherZKsync.sol` contract, that is fully compatible with the `ERC20` and and `ERC20Permit` standards, but also has a few unique functionalities:

- **minting tokens upon finalizing L1 deposit** (via `bridgeMint`, invoked only by the `L2SharedBridge.sol` with the `BRIDGE_ROLE` role)
- **burning tokens upon initializing L2 withdrawal** (via `bridgeBurn`, invoked only by the `L2SharedBridge.sol` with the `BRIDGE_ROLE` role)
- **EIP-3009 compatible signature operations for token transfers for EOAs and EIP-1271 smart accounts** (via `transferWithAuthorization`, `receiveWithAuthorization` and `cancelAuthorization`, which are contained in `TetherTokenV2.sol` and `EIP3009Upgradeable.sol` contracts)

Unique to Tether, `WithBlockedList.sol` also contains a `blocking`/`unblocking` of tokens, which have already been mentioned. Owner of the contract can block assets of users that are deemed to be malicious actors (via `addToBlockedList`). Those assets can no longer be moved using `transfer`/`transferFrom` and can then either be:

- **unblocked** (via `removeFromBlockedList`), invoked only by owner of the contract, so that users can continue using their assets freely
- **destroyed** (via `destroyBlockedFunds`), where users' tokens are burned

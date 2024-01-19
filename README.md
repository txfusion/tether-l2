# Tether L2

This repository features the infrastructure for bridging Tether USD from Ethereum to ZkSync Era, alongside with common bridge administration features, such as enabling/disabling deposits/withdrawals, and Tether's own blacklisting (here called `freezing`) and destuction (here called `burning`) mechanisms of tokens owned by presumably evil actors in the system.

## Setup

If you'd like to run a local version of this projects, please do the following:

1. Install `jq` if you don't have it (via `brew install jq`)
2. Run `./compile.sh`
   - Make sure that `addresses.${NODE_ENV}.json` is generated properly
3. Run `./deploy.sh`
   - Make sure that `.env` is setup properly, notably the `CONTRACTS_DIAMOND_PROXY_ADDR`, `PRIVATE_KEY` and the URLs of the local Ethereum and ZkSync Era nodes.

From here, you can run `npm run test` to confirm that everything went smoothly, and then run `cd l1 && npm run test-deposit && npm run test-withdraw` to perform a simulation of the deposit + withdraw flow.

## Project Layout

This project consists of two folders: `l1` and `l2`. Both folders contain Hardhat projects and relevant dependencies for their chains. Some packages and contracts are shared between both projects, which can be found in the root folder.

## L1

### Contracts

The core of this subfolder is the `L1ERC20Bridge.sol` contract, that handles:

- **depositing funds to the bridge** (via one of the two `deposit` function, either with or without the L2 gas `_refundRecipient`, to initiate bridging of tokens over to L2)
- **claiming failed deposits** (via `claimFailedDeposit`, in case L2 side of things fail for any reason)
- **finalizing withdrawals** (via `finalizeWithdrawal`, in case user wants to go back to L1)

The `L1ERC20Bridge.sol` also extends the `BridgingManager.sol` contract, that features enabling/disabling deposits/withdrawals on the L1.

Since it is assumed that L1 already contains an `ERC20` token that should be bridged, all other contracts in this subfolder are mocks that are used in end-to-end testing in the local environment.

### Scripts

This subfolder also contains a few useful scripts for interaction with the administrative functions of the L1 bridge, such as: `enable-deposits`, `disable-deposits` and `enable-withdrawals`.

These can be triggered only by the private key that has the appropriate roles, which are set in the `initialize-bridge-roles` script which is ran during the deployment of the bridge contract.

## L2

### Contracts

There are two core contracts: `L2ERC20Bridge.sol` and `ERC20BridgedUpgradeable.sol`.

`L2ERC20Bridge.sol` is the `L1ERC20Bridge.sol`'s counterpart and it handles:

- **finalizing deposits** (via `finalizeDeposit`, to finally bridge L1 tokens to L2)
- **withdrawing funds from the bridge** (via `withdraw`, to initiate bridging of tokens over to L1)

The `L2ERC20Bridge.sol` also extends the `BridgingManager.sol` contract, that features enabling/disabling deposits/withdrawals on the L2.

On L2, it is not assumed that there's an ERC20 token that's a counterpart to the bridged L1 token, there is a `ERC20BridgedUpgradeable.sol` contract, that is fully compatible with the `ERC20` standard, but also has a few unique functionalities:

- **minting tokens upon finalizing L1 deposit** (via `bridgeMint`, invoked only by the `L2ERC20Bridge.sol`)
- **burning tokens upon initializing L2 withdrawal** (via `bridgeBurn`, invoked only by the `L2ERC20Bridge.sol`)
- **burning frozen tokens** (via `burnFrozenTokensEscrow`, invoked only by the admin with the `ADDRESS_BURNER_ROLE`, which burn user's token and mint them back to an escrow account of choice, to preserve L2 total supply)

Unique to Tether, `ERC20BridgedUpgradeable.sol` also contains a `freezing`/`burning` of tokens, which has already been mentioned. Administrators with appropriate roles (`ADDRESS_FREEZER_ROLE` and `ADDRESS_BURNER_ROLE`) can freeze assets of users that are deemed to be malicious actors (via `freezeAddress`). Those assets can no longer be moved using `transfer`/`transferFrom` and can then either be:

- **unfrozen** (via `unfreezeAddress`, invoked only by admins with the `ADDRESS_FREEZER_ROLE`), so that users can continue using their assets freely
- **burned** (via `burnFrozenTokensEscrow` or `burnFrozenTokens`, invoked only by the `ADDRESS_BURNER_ROLE`), where users' tokens are burned and then reminted to the escrow account of choice (either a specified address or simply the admin's address)

# Tether L2

# Setup

1. Install `jq` if you don't have it (via `brew install jq`)
2. Run `./compile.sh`
   - Make sure that `addresses.${NODE_ENV}.json` is generated properly
3. Run `./deploy.sh`
   - Make sure that `.env` is setup properly, most importantly the `CONTRACTS_DIAMOND_PROXY_ADDR`

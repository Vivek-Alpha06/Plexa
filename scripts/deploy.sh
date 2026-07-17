#!/usr/bin/env bash
# Deploy Plexa to a Stellar network (default: testnet).
#
# Deploys the full v3 topology: price oracle + Soroswap-compatible swap router +
# factory (which deploys group instances). USDC is an existing token contract;
# XLM is the native SAC.
#
# Usage:
#   STELLAR_ACCOUNT=alice USDC_CONTRACT=C... ./scripts/deploy.sh
#
# Requires: stellar-cli configured with an identity (`stellar keys ...`).
# NOTE: testnet rejects the wasm32-unknown-unknown build (reference-types); build
# for wasm32v1-none and this script deploys from that path.
set -euo pipefail
cd "$(dirname "$0")/../contracts"

NETWORK="${NETWORK:-testnet}"
SOURCE="${STELLAR_ACCOUNT:?set STELLAR_ACCOUNT to a configured stellar identity}"
USDC="${USDC_CONTRACT:?set USDC_CONTRACT to the USDC token contract id on $NETWORK}"
# Initial XLM price in USDC (7dp). Default 0.115 USDC.
XLM_PRICE="${XLM_PRICE:-1150000}"

OUT=target/wasm32v1-none/release
[ -f "$OUT/plexa_group.wasm" ] || cargo build --target wasm32v1-none --release

ADMIN=$(stellar keys address "$SOURCE")
XLM=$(stellar contract id asset --asset native --network "$NETWORK")
echo "admin: $ADMIN"
echo "XLM SAC: $XLM"

echo "==> Uploading group wasm"
GROUP_HASH=$(stellar contract upload --wasm "$OUT/plexa_group.wasm" \
  --source "$SOURCE" --network "$NETWORK")
echo "group wasm hash: $GROUP_HASH"

echo "==> Deploying oracle"
ORACLE=$(stellar contract deploy --wasm "$OUT/plexa_oracle.wasm" \
  --source "$SOURCE" --network "$NETWORK" -- \
  --admin "$ADMIN" --initial_price "$XLM_PRICE")
echo "oracle: $ORACLE"

echo "==> Deploying swap router"
ROUTER=$(stellar contract deploy --wasm "$OUT/plexa_swap.wasm" \
  --source "$SOURCE" --network "$NETWORK" -- \
  --admin "$ADMIN" --oracle "$ORACLE" --xlm "$XLM" --usdc "$USDC")
echo "router: $ROUTER"

echo "==> Deploying factory"
FACTORY=$(stellar contract deploy --wasm "$OUT/plexa_factory.wasm" \
  --source "$SOURCE" --network "$NETWORK" -- \
  --admin "$ADMIN" --wasm_hash "$GROUP_HASH" \
  --usdc "$USDC" --xlm "$XLM" --oracle "$ORACLE" --router "$ROUTER")
echo "factory: $FACTORY"

echo
echo "Seed liquidation liquidity (optional):"
echo "  stellar contract invoke --id $ROUTER --source $SOURCE --network $NETWORK --send=yes -- deposit --from $ADMIN --amount <usdc_7dp>"
echo
echo "Done. Export these for the frontend:"
echo "  VITE_FACTORY_ID=$FACTORY"
echo "  VITE_USDC_ID=$USDC"
echo "  VITE_XLM_ID=$XLM"
echo "  VITE_ORACLE_ID=$ORACLE"
echo "  VITE_ROUTER_ID=$ROUTER"
echo "  VITE_NETWORK=$NETWORK"

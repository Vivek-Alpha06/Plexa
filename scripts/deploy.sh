#!/usr/bin/env bash
# Deploy Plexa to a Stellar network (default: testnet).
#
# Deploys the Reflector oracle adapter + the factory (which in turn deploys
# group instances). Tokens (USDC, native XLM) and the swap venue are *existing*
# contracts on the target network — this script never invents them.
#
# Usage:
#   STELLAR_ACCOUNT=plexa-deploy ./scripts/deploy.sh                    # testnet
#   NETWORK=mainnet STELLAR_ACCOUNT=plexa-mainnet ./scripts/deploy.sh   # mainnet
#
# Requires: stellar-cli configured with an identity (`stellar keys ...`) and a
# network entry of the same name (`stellar network add ...`).
#
# NOTE: the wasm32-unknown-unknown build emits reference-types/multivalue, which
# the network rejects on upload. Build for wasm32v1-none; this script deploys
# from that path.
set -euo pipefail
cd "$(dirname "$0")/../contracts"

NETWORK="${NETWORK:-testnet}"
SOURCE="${STELLAR_ACCOUNT:?set STELLAR_ACCOUNT to a configured stellar identity}"

# --------------------------------------------------------------- network deps
# Per-network addresses of contracts we consume but do not own. Overridable, but
# defaulted so a deploy cannot silently point at the wrong network's tokens.
#
# Reflector price feeds ("External CEXs & DEXs" feed, base USD, 14dp, 300s
# resolution) — https://developers.stellar.org/docs/data/oracles/oracle-providers
# Soroswap routers — soroswap/core `public/{mainnet,testnet}.contracts.json`
case "$NETWORK" in
  mainnet|mainnet-*|public|public-*)
    IS_MAINNET=1
    DEF_USDC=CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75  # Circle USDC SAC
    DEF_REFLECTOR=CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN
    DEF_ROUTER=CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH
    ;;
  testnet|testnet-*)
    IS_MAINNET=0
    DEF_USDC=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA  # Circle testnet USDC SAC
    DEF_REFLECTOR=CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63
    DEF_ROUTER=CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD
    ;;
  *)
    IS_MAINNET=0
    DEF_USDC=""; DEF_REFLECTOR=""; DEF_ROUTER=""
    ;;
esac

USDC="${USDC_CONTRACT:-$DEF_USDC}"
REFLECTOR="${REFLECTOR_CONTRACT:-$DEF_REFLECTOR}"
ROUTER="${ROUTER_CONTRACT:-$DEF_ROUTER}"

[ -n "$USDC" ]      || { echo "error: set USDC_CONTRACT (no default for network '$NETWORK')" >&2; exit 1; }
[ -n "$REFLECTOR" ] || { echo "error: set REFLECTOR_CONTRACT (no default for network '$NETWORK')" >&2; exit 1; }

# Oracle staleness bound, seconds. Must sit comfortably above Reflector's 300s
# resolution or `price()` fails routinely between publishes.
MAX_AGE="${ORACLE_MAX_AGE:-1800}"
BASE_SYM="${ORACLE_BASE:-XLM}"
QUOTE_SYM="${ORACLE_QUOTE:-USDC}"

RAW=target/wasm32v1-none/release
OUT=target/wasm32v1-none/optimized
# Always build. Testing for the file's existence would happily deploy whatever
# artifact was left in target/ by an older checkout — shipping bytecode that
# does not match the source tree. Cargo is incremental, so this is nearly free
# when nothing changed.
cargo build --workspace --target wasm32v1-none --release --locked

# Optimize before upload. Soroban charges state rent by bytecode size, so this
# is not cosmetic — it cut a measured 22% off the mainnet upload cost
# (156 XLM -> 122 XLM). Run `scripts/estimate-fees.mjs` to re-measure.
mkdir -p "$OUT"
for c in plexa_group plexa_factory plexa_oracle plexa_swap; do
  [ -f "$RAW/$c.wasm" ] || continue
  stellar contract optimize --wasm "$RAW/$c.wasm" --wasm-out "$OUT/$c.wasm" >/dev/null
done
echo "==> Optimized artifacts:"
for c in plexa_group plexa_factory plexa_oracle; do
  printf '    %-16s %6s B -> %6s B\n' "$c" \
    "$(stat -c%s "$RAW/$c.wasm")" "$(stat -c%s "$OUT/$c.wasm")"
done

ADMIN=$(stellar keys address "$SOURCE")
XLM=$(stellar contract id asset --asset native --network "$NETWORK")

# `contracts/swap` is a MOCK venue for testnet: it fills from its own reserve at
# the oracle price with no slippage and no fee. On mainnet it must never be used
# — liquidations would route into an empty contract, and because the group calls
# the router with `try_invoke_contract`, the failure degrades silently to member
# debt rather than erroring. Real money requires a real venue. Fail early, before
# anything is uploaded, rather than midway through a partial deploy.
if [ -z "$ROUTER" ] && [ "$IS_MAINNET" = "1" ]; then
  echo "error: refusing to deploy the mock swap venue on $NETWORK." >&2
  echo "       Set ROUTER_CONTRACT to the real Soroswap router." >&2
  exit 1
fi

echo "network:   $NETWORK"
echo "admin:     $ADMIN"
echo "XLM SAC:   $XLM"
echo "USDC:      $USDC"
echo "reflector: $REFLECTOR"
echo "router:    ${ROUTER:-<mock, to be deployed>}"
echo

echo "==> Uploading group wasm"
GROUP_HASH=$(stellar contract upload --wasm "$OUT/plexa_group.wasm" \
  --source "$SOURCE" --network "$NETWORK")
echo "group wasm hash: $GROUP_HASH"

# Reuse an existing oracle adapter if one is supplied; otherwise deploy one.
if [ -n "${ORACLE_CONTRACT:-}" ]; then
  ORACLE="$ORACLE_CONTRACT"
  echo "==> Reusing oracle $ORACLE"
else
  echo "==> Deploying oracle (Reflector adapter)"
  ORACLE=$(stellar contract deploy --wasm "$OUT/plexa_oracle.wasm" \
    --source "$SOURCE" --network "$NETWORK" -- \
    --admin "$ADMIN" --reflector "$REFLECTOR" \
    --base "$BASE_SYM" --quote "$QUOTE_SYM" --max_age "$MAX_AGE")
  echo "oracle: $ORACLE"
fi

# The mock venue prices off our oracle, so it can only be deployed once the
# oracle exists. Testnet-only: the mainnet guard above has already exited.
if [ -z "$ROUTER" ]; then
  echo "==> Deploying mock swap venue (no ROUTER_CONTRACT given)"
  ROUTER=$(stellar contract deploy --wasm "$OUT/plexa_swap.wasm" \
    --source "$SOURCE" --network "$NETWORK" -- \
    --admin "$ADMIN" --oracle "$ORACLE" --xlm "$XLM" --usdc "$USDC")
  echo "router: $ROUTER"
  MOCK_ROUTER=1
fi

echo "==> Sanity-checking the price feed"
# A deploy that produces an oracle which cannot price is worse than no deploy:
# groups would take XLM collateral they cannot size or liquidate.
stellar contract invoke --id "$ORACLE" --source "$SOURCE" --network "$NETWORK" \
  -- price

echo "==> Deploying factory"
FACTORY=$(stellar contract deploy --wasm "$OUT/plexa_factory.wasm" \
  --source "$SOURCE" --network "$NETWORK" -- \
  --admin "$ADMIN" --wasm_hash "$GROUP_HASH" \
  --usdc "$USDC" --xlm "$XLM" --oracle "$ORACLE" --router "$ROUTER")
echo "factory: $FACTORY"

if [ "${MOCK_ROUTER:-0}" = "1" ]; then
  echo
  echo "Mock venue deployed — seed it with USDC or liquidations degrade to debt:"
  echo "  stellar contract invoke --id $ROUTER --source $SOURCE --network $NETWORK --send=yes -- deposit --from $ADMIN --amount <usdc_7dp>"
fi

echo
echo "Done. Export these for the frontend:"
echo "  VITE_NETWORK=$NETWORK"
echo "  VITE_FACTORY_ID=$FACTORY"
echo "  VITE_USDC_ID=$USDC"
echo "  VITE_XLM_ID=$XLM"
echo "  VITE_ORACLE_ID=$ORACLE"
echo "  VITE_ROUTER_ID=$ROUTER"
echo
echo "Group wasm hash (record this — it is what members' funds run on):"
echo "  $GROUP_HASH"
echo
echo "Local artifact hashes (should match what was uploaded):"
sha256sum "$OUT"/plexa_group.wasm "$OUT"/plexa_factory.wasm "$OUT"/plexa_oracle.wasm 2>/dev/null || true

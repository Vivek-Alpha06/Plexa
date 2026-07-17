#!/usr/bin/env bash
# Build the Plexa contract wasm artifacts.
set -euo pipefail
cd "$(dirname "$0")/../contracts"

cargo build --target wasm32-unknown-unknown --release

OUT=target/wasm32-unknown-unknown/release
echo "Built:"
ls -la "$OUT"/plexa_group.wasm "$OUT"/plexa_factory.wasm

# Optionally optimize if the stellar CLI is available.
if command -v stellar >/dev/null 2>&1; then
  stellar contract optimize --wasm "$OUT/plexa_group.wasm" || true
  stellar contract optimize --wasm "$OUT/plexa_factory.wasm" || true
fi

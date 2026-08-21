#!/usr/bin/env bash
# Build the Plexa contract wasm artifacts.
set -euo pipefail
cd "$(dirname "$0")/../contracts"

stellar contract build --optimize

OUT=target/wasm32v1-none/release
echo "Built & Optimized:"
ls -la "$OUT"/plexa_*.wasm


#!/usr/bin/env bash
# Run native unit tests. On Windows-GNU the cdylib crate-type breaks the native
# test link (PE export-ordinal limit), so we swap to rlib for the test run only.
set -euo pipefail
cd "$(dirname "$0")/../contracts"

CRATES="group/Cargo.toml factory/Cargo.toml oracle/Cargo.toml swap/Cargo.toml"

restore() {
  sed -i 's/crate-type = \["rlib"\]/crate-type = ["cdylib", "rlib"]/' $CRATES
}
trap restore EXIT

sed -i 's/crate-type = \["cdylib", "rlib"\]/crate-type = ["rlib"]/' $CRATES

cargo test --offline "$@"

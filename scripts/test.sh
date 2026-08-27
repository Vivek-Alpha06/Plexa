#!/usr/bin/env bash
# Run native unit tests. On Windows-GNU the cdylib crate-type breaks the native
# test link (PE export-ordinal limit), so we swap to rlib for the test run only
# and restore the manifests on exit.
#
# The crate list is derived from the workspace members rather than hardcoded:
# a hardcoded list silently rotted once already, naming a `lite/` crate that no
# longer exists, which made `sed` fail and the script exit 0 without ever
# running a test.
set -euo pipefail
cd "$(dirname "$0")/../contracts"

mapfile -t MEMBERS < <(
  awk '/^members[[:space:]]*=/{flag=1} flag{print} /\]/{if(flag)exit}' Cargo.toml \
    | grep -o '"[^"]*"' | tr -d '"'
)

CRATES=()
for m in "${MEMBERS[@]}"; do
  manifest="$m/Cargo.toml"
  if [ ! -f "$manifest" ]; then
    echo "workspace member missing: $manifest" >&2
    exit 1
  fi
  CRATES+=("$manifest")
done

if [ ${#CRATES[@]} -eq 0 ]; then
  echo "no workspace members found in contracts/Cargo.toml" >&2
  exit 1
fi

echo "testing crates: ${CRATES[*]}"

restore() {
  sed -i 's/crate-type = \["rlib"\]/crate-type = ["cdylib", "rlib"]/' "${CRATES[@]}"
}
trap restore EXIT

sed -i 's/crate-type = \["cdylib", "rlib"\]/crate-type = ["rlib"]/' "${CRATES[@]}"

cargo test --offline "$@"

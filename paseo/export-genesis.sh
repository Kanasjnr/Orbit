#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/load-env.sh"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/paseo/generated"
RAW="$OUT/raw_chain_spec.json"
NODE="$ROOT/target/release/parachain-template-node"

[[ -f "$RAW" ]] || { echo "missing $RAW — run paseo/build-spec.sh first"; exit 1; }
[[ -x "$NODE" ]] || {
  cargo build -p parachain-template-node --release --manifest-path "$ROOT/Cargo.toml"
}

mkdir -p "$OUT"

"$NODE" export-genesis-wasm --chain "$RAW" "$OUT/orbit.wasm"
"$NODE" export-genesis-head --chain "$RAW" "$OUT/orbit-head"

echo "register on Paseo:"
echo "  wasm:  $OUT/orbit.wasm"
echo "  head:  $OUT/orbit-head"
echo "  cd scripts && npm run paseo:register"

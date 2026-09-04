#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/load-env.sh"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/paseo/generated"
PARA_ID="${PARA_ID:?set PARA_ID in orbit.env}"
CHAIN_NAME="${CHAIN_NAME:-orbit-paseo}"
RELAY="${RELAY_CHAIN:-paseo}"

WASM="$ROOT/target/release/wbuild/parachain-template-runtime/parachain_template_runtime.compact.compressed.wasm"
PLAIN="$OUT/plain_chain_spec.json"
RAW="$OUT/raw_chain_spec.json"

command -v chain-spec-builder >/dev/null ||
  { echo "install: cargo install staging-chain-spec-builder --locked"; exit 1; }

mkdir -p "$OUT"

echo "building runtime (release)…"
cargo build -p parachain-template-runtime --release --manifest-path "$ROOT/Cargo.toml"

if [[ ! -f "$WASM" ]]; then
  echo "missing $WASM"
  exit 1
fi

if [[ ! -f "$PLAIN" ]]; then
  echo "creating plain chain spec para=$PARA_ID relay=$RELAY"
  chain-spec-builder \
    --chain-spec-path "$PLAIN" \
    create \
    --relay-chain "$RELAY" \
    --para-id "$PARA_ID" \
    --runtime "$WASM" \
    named-preset local_testnet

  node -e "
    const fs = require('fs');
    const p = process.argv[1];
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.name = process.argv[2];
    j.id = process.argv[2];
    j.protocolId = process.argv[2];
    j.chainType = 'Live';
    j.para_id = Number(process.argv[3]);
    j.properties = j.properties || {};
    j.properties.tokenSymbol = 'PAS';
    j.properties.tokenDecimals = 10;
    if (j.genesis?.runtimeGenesis?.patch?.parachainInfo) {
      j.genesis.runtimeGenesis.patch.parachainInfo.parachainId = Number(process.argv[3]);
    }
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  " "$PLAIN" "$CHAIN_NAME" "$PARA_ID"

  echo ""
  echo "run: bash paseo/patch-spec.sh  then re-run: bash paseo/build-spec.sh"
  exit 0
fi

echo "converting plain → raw"
rm -f "$RAW"
chain-spec-builder --chain-spec-path "$RAW" convert-to-raw "$PLAIN"
[[ -f "$RAW" ]] || { echo "convert-to-raw failed — no $RAW"; exit 1; }
echo "raw spec: $RAW"

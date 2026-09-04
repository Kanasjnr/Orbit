#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/load-env.sh"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/paseo/generated"
RAW="$OUT/raw_chain_spec.json"
NODE="$ROOT/target/release/parachain-template-node"

PARA_ID="${PARA_ID:?set PARA_ID in orbit.env}"
COLLATOR_PORT="${COLLATOR_PORT:-40333}"
COLLATOR_RPC="${COLLATOR_RPC:-8845}"
RELAY_PORT="${RELAY_PORT:-50343}"
RELAY_RPC="${RELAY_RPC:-9988}"
RELAY_CHAIN="${RELAY_CHAIN:-paseo}"
PASEO_RELAY_SPEC="${PASEO_RELAY_SPEC:-$OUT/paseo.raw.json}"
PASEO_RELAY_SPEC_URL="${PASEO_RELAY_SPEC_URL:-https://raw.githubusercontent.com/paseo-network/paseo-chain-specs/main/paseo.raw.json}"
BASE="${COLLATOR_BASE:-$ROOT/paseo/data-$PARA_ID}"
NODE_KEY_FILE="$BASE/.node-key"

[[ -f "$RAW" ]] || { echo "missing $RAW — run paseo/build-spec.sh"; exit 1; }
[[ -x "$NODE" ]] || {
  cargo build -p parachain-template-node --release --manifest-path "$ROOT/Cargo.toml"
}

mkdir -p "$BASE"

if [[ -f "$NODE_KEY_FILE" ]]; then
  COLLATOR_NODE_KEY="$(tr -d '[:space:]' < "$NODE_KEY_FILE")"
elif [[ -n "${COLLATOR_NODE_KEY:-}" ]]; then
  echo "$COLLATOR_NODE_KEY" > "$NODE_KEY_FILE"
else
  COLLATOR_NODE_KEY="$(openssl rand -hex 32)"
  echo "$COLLATOR_NODE_KEY" > "$NODE_KEY_FILE"
  echo "saved libp2p node key to $NODE_KEY_FILE (or set COLLATOR_NODE_KEY in orbit.env)"
fi

if [[ ! -f "$PASEO_RELAY_SPEC" ]]; then
  echo "fetching Paseo V2 relay spec → $PASEO_RELAY_SPEC"
  curl -fsSL "$PASEO_RELAY_SPEC_URL" -o "$PASEO_RELAY_SPEC"
fi

RELAY_BOOTNODES=()
while IFS= read -r bn; do
  [[ -n "$bn" ]] && RELAY_BOOTNODES+=(--bootnodes "$bn")
done < <(
  python3 - "$PASEO_RELAY_SPEC" <<'PY'
import json, sys
for bn in json.load(open(sys.argv[1])).get("bootNodes", []):
    print(bn)
PY
)

if ((${#RELAY_BOOTNODES[@]} == 0)); then
  echo "warning: no bootNodes in $PASEO_RELAY_SPEC — relay sync may stall"
fi

echo "collator rpc ws://127.0.0.1:$COLLATOR_RPC  para $PARA_ID"
echo "relay spec $PASEO_RELAY_SPEC"
echo "after sync: bash paseo/insert-session-key.sh"
echo "if relay shows mixed genesis hashes, stop and: rm -rf $BASE/polkadot"

exec "$NODE" \
  --collator \
  --force-authoring \
  --chain "$RAW" \
  --base-path "$BASE" \
  --node-key "$COLLATOR_NODE_KEY" \
  --port "$COLLATOR_PORT" \
  --rpc-port "$COLLATOR_RPC" \
  --rpc-cors all \
  --rpc-methods unsafe \
  -- \
  --sync warp \
  --chain "$PASEO_RELAY_SPEC" \
  --port "$RELAY_PORT" \
  --rpc-port "$RELAY_RPC" \
  "${RELAY_BOOTNODES[@]}"

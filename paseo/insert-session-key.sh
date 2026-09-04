#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/load-env.sh"

RPC="${COLLATOR_RPC:-8845}"
URI="${PASEO_SESSION_URI:?set PASEO_SESSION_URI in orbit.env}"
PUB="${PASEO_SESSION_PUBKEY:?set PASEO_SESSION_PUBKEY in orbit.env (0x… hex from subkey)}"

curl -sS -H "Content-Type: application/json" \
  --data "{\"jsonrpc\":\"2.0\",\"method\":\"author_insertKey\",\"params\":[\"aura\",\"${URI}\",\"${PUB}\"],\"id\":1}" \
  "http://127.0.0.1:${RPC}" | tee /dev/stderr
echo

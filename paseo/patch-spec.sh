#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/load-env.sh"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLAIN="$ROOT/paseo/generated/plain_chain_spec.json"
OPERATOR="${PASEO_OPERATOR:?set PASEO_OPERATOR in orbit.env}"
AURA="${PASEO_AURA:-$OPERATOR}"
BALANCE="${PASEO_BALANCE:-1152921504606846976}"

[[ -f "$PLAIN" ]] || { echo "missing $PLAIN — run PARA_ID=… paseo/build-spec.sh first"; exit 1; }

node <<EOF
const fs = require("fs");
const plain = "$PLAIN";
const operator = "$OPERATOR";
const aura = "$AURA";
const balance = "$BALANCE";

const j = JSON.parse(fs.readFileSync(plain, "utf8"));
const p = j.genesis.runtimeGenesis.patch;

p.balances = { balances: [[operator, "___BALANCE___"]] };
p.collatorSelection = {
  candidacyBond: p.collatorSelection?.candidacyBond ?? 16000000000,
  desiredCandidates: 0,
  invulnerables: [operator],
};
p.session = {
  keys: [[operator, operator, { aura }]],
  nonAuthorityKeys: [],
};
p.sudo = { key: operator };

let out = JSON.stringify(j, null, 2);
out = out.replace('"___BALANCE___"', balance);
fs.writeFileSync(plain, out + "\n");
console.log("patched", plain);
console.log("operator", operator);
console.log("aura", aura);
EOF

echo "next: bash paseo/build-spec.sh"

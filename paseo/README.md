# Paseo

Public testnet step after Zombienet and Chopsticks. Same Orbit runtime, relay `paseo`, real PAS faucet, shareable RPC.

## Config

All Paseo settings live in one file:

```bash
cp paseo/orbit.env.example paseo/orbit.env
```

Every script under `paseo/` sources `load-env.sh`, which reads `paseo/orbit.env` (override with `ORBIT_ENV=/path/to/env`). `scripts/paseo-relay.ts` loads the same file when you run `npm run paseo:*`.

| Variable | Purpose |
|----------|---------|
| `PARA_ID` | Reserved para id (e.g. `2002`) |
| `PASEO_URI` | Operator mnemonic or `//Alice` — **testnet only** |
| `PASEO_OPERATOR` | SS58 for sudo, collator, balances |
| `PASEO_AURA` | Aura id in genesis session keys |
| `PASEO_SESSION_URI` | Session mnemonic for `author_insertKey` |
| `PASEO_SESSION_PUBKEY` | Session public key hex (`0x…` from `subkey inspect`) |
| `PASEO_WS` | Paseo relay RPC |
| `COLLATOR_*`, `RELAY_*` | Collator / embedded relay ports |
| `HUB_WS`, `ORBIT_WS` | Asset Hub observer (later) |
| `ORBIT_ORACLE_URI` | Hub reporter signer — runtime oracle is `//Alice` today |

## Prerequisites

Rust **1.93.1** (`rustup show` in repo root). PAS on **Paseo Relay** for `registrar.reserve`, `registrar.register`, and coretime. [Polkadot faucet](https://faucet.polkadot.io/) — pick **Paseo Relay**, not Asset Hub.

Install once:

```bash
cargo install staging-chain-spec-builder --locked
cd scripts && npm install
```

## Without Polkadot.js extension

Generate a fresh test key if needed:

```bash
docker run --rm parity/subkey generate --scheme sr25519
```

Put the mnemonic in `orbit.env` as `PASEO_URI`, set `PASEO_OPERATOR` to the SS58, fund from the faucet, then:

```bash
bash paseo/balance.sh
bash paseo/reserve.sh
```

Copy the printed `PARA_ID` into `orbit.env`.

Generate a **separate** Aura session key (`subkey generate --scheme sr25519`). Set `PASEO_AURA` (SS58), `PASEO_SESSION_URI`, and `PASEO_SESSION_PUBKEY` (`subkey inspect --scheme ed25519 <uri>` → public key hex).

## Build chain spec

```bash
bash paseo/build-spec.sh          # creates plain spec
bash paseo/patch-spec.sh          # operator / aura / sudo / balances
bash paseo/build-spec.sh          # plain → raw
bash paseo/export-genesis.sh      # orbit.wasm + orbit-head
```

## Register

```bash
bash paseo/register.sh
```

Wait for onboarding, then obtain coretime (on-demand or bulk). Collator must stay synced to relay.

On-demand (uses `PASEO_URI` from `orbit.env`, no browser wallet):

```bash
bash paseo/coretime.sh
```

Optional: `PASEO_CORETIME_MAX=5000000000000` (5 PAS). Set `PASEO_CORETIME_ALLOW_DEATH=1` to use `placeOrderAllowDeath` instead of keep-alive.

PAPI Console has no mnemonic import — connect [Polkadot.js extension](https://polkadot.js.org/extension/) or Talisman (import mnemonic there first), then pick that wallet in the console.

## Run collator

```bash
bash paseo/run-collator.sh
```

The script downloads `paseo/generated/paseo.raw.json` (Paseo V2 relay) and passes its bootnodes to the embedded relay. Do **not** use `--chain paseo` alone — the binary’s bundled spec is the sunset chain.

On first start a libp2p node key is saved to `paseo/data-$PARA_ID/.node-key` (fixes `NetworkKeyNotFound`). After the node is up:

```bash
bash paseo/insert-session-key.sh
```

Point Polkadot.js at `ws://127.0.0.1:$COLLATOR_RPC`.

## Hub observer on Paseo

Staking rewards still come from Asset Hub. After Orbit collator is live and you have real bonded stashes on Paseo Asset Hub:

```bash
cd scripts
# HUB_WS / ORBIT_WS from orbit.env if sourced, or export manually
npm run observe
```

Chopsticks lab (`hub:setup` / `hub:payout`) stays for fast shape testing. Paseo uses live extrinsics and real eras.

## Paseo relay migration (2026)

Paseo is moving to a new relay (V2). Watch [forum.polkadot.network](https://forum.polkadot.network/t/paseo-testnet-relay-downsizing-sunset/17995) for cutover timing. Runtime should implement `AnyRelayNumber` before repointing collators.

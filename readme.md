# Orbit

Liquid staking for Polkadot after the June 2026 reward split: **oDOT** (nomination, no Hub slash) and **eDOT** (validator self-stake incentive, Hub-slashable). Operators run nodes via `StakingOperator`; they cannot move funds. In v1, stash keys sit under Orbit multisig — that is the custody boundary, not end-user self-custody of the stash.

**Spec:** [WHITEPAPER.md](./WHITEPAPER.md). If this README and the whitepaper disagree, the whitepaper wins.

Status: FRAME parachain scaffold on **`next-release`** (development trunk). **Not audited. Not mainnet. Do not deposit real DOT.**

---

## Branches

| Branch | Role |
| ------ | ---- |
| `main` | Merged releases / stable snapshots |
| `next-release` | **Active development** — all MVP work targets this branch |

Open PRs from **`next-release` → `main`**. All feature work lands on `next-release` first.

---

## This repo today

| Path | What it is |
| ---- | ---------- |
| `WHITEPAPER.md` | Protocol + economics spec (source of truth) |
| `runtime/` | Orbit parachain runtime (Polkadot SDK template) |
| `node/` | Optional collator node binary |
| `pallets/odot/` | oDOT vault pallet deposit, redeem, exchange-rate accounting (§9) |
| `pallets/edot/` | eDOT vault pallet deposit, redeem, queue, Hub slash (§9–10) |
| `pallets/hub-feed/` | Hub observation ingress: nomination/self-stake rewards + eDOT slash (§17) |
| `chopsticks/` | Chopsticks Hub-fork config for feed PoC |
| `zombienet.toml` / `zombienet-omni-node.toml` | Local network configs |
| `dev_chain_spec.json` | Dev chain spec for Omni Node + Zombienet |

Phases **B–D.2** (vaults, unbond queues, `pallet-hub-feed`) are on the trunk. Hub observation uses **PAPI** typed descriptors + finalized-event watches (`scripts/hub-feed-observe.ts`); Chopsticks is an optional local fork. PR CI typechecks scripts and exercises `hubFeed.report*` in Zombienet full Chopsticks+observe stays local (see `chopsticks/README.md`). Unbond delay is still a short PoC (not Hub-aligned).

---

## Build (scaffold check)

Rust is pinned in `rust-toolchain.toml` to **1.93.1** (Rust ≥1.96 breaks Substrate WASM linking: `ext_storage_*` undefined symbols). Run `rustup show` in this repo so rustup installs that pin.

```bash
rustup show
cargo check -p pallet-odot
cargo check -p pallet-edot
cargo check -p parachain-template-runtime
```

Full release build is slower:

```bash
cargo build -p parachain-template-runtime --release
```

### Zombienet (local proof)

Build collator + relay (macOS: compile `polkadot` from `polkadot-stable2512`; Linux CI downloads release binaries):

```bash
cargo +1.93.1 build -p parachain-template-node --release
export PATH="$PWD/target/release:$PATH"

# network + oDOT/eDOT deposit (relay, para 1000, extrinsics)
npx --yes @zombienet/cli --provider native test .github/tests/zombienet-integration.zndsl
```

Polkadot.js on the collator WS port from Zombienet output (e.g. `ws://127.0.0.1:…`). `polkadot-omni-node --dev` is not the primary path Aura slot mismatch on mock relay.

---

## Disclosures

Code is unaudited until a production audit lands. v1 production custody is **multisig stash + `StakingOperator`**, not “users keep the stash.” Hub slash hits **eDOT only**; oDOT is not a slash waterfall. Theft or buggy accounting can still impair either vault. Economic figures in the whitepaper (including any ~73% anecdote) are not promised APYs.

Full list: whitepaper §16.

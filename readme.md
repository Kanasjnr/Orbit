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

Open PRs against `next-release` unless you are cutting a release into `main`.

---

## This repo today

| Path | What it is |
| ---- | ---------- |
| `WHITEPAPER.md` | Protocol + economics spec (source of truth) |
| `runtime/` | Orbit parachain runtime (Polkadot SDK template) |
| `node/` | Optional collator node binary |
| `pallets/template/` | Placeholder pallet (replaced by oDOT/eDOT in later PRs) |
| `zombienet.toml` / `zombienet-omni-node.toml` | Local network configs |
| `dev_chain_spec.json` | Dev chain spec for Omni Node + Zombienet |

Scaffold is based on [polkadot-sdk-parachain-template](https://github.com/paritytech/polkadot-sdk-parachain-template). Product pallets come next (whitepaper §17).

---

## Build (scaffold check)

Rust is pinned in `rust-toolchain.toml` to **1.93.1** (Rust ≥1.96 breaks Substrate WASM linking: `ext_storage_*` undefined symbols). Run `rustup show` in this repo so rustup installs that pin.

```bash
rustup show
cargo check -p pallet-parachain-template
cargo check -p parachain-template-runtime
```

Full release build is slower:

```bash
cargo build -p parachain-template-runtime --release
```

Zombienet / Omni Node install and run are documented in later PRs once the network is wired for Orbit.

---

## Disclosures

Code is unaudited until a production audit lands. v1 production custody is **multisig stash + `StakingOperator`**, not “users keep the stash.” Hub slash hits **eDOT only**; oDOT is not a slash waterfall. Theft or buggy accounting can still impair either vault. Economic figures in the whitepaper (including any ~73% anecdote) are not promised APYs.

Full list: whitepaper §16.

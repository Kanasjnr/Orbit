# Orbit

Liquid staking for Polkadot after the June 2026 reward split: **oDOT** (nomination, no Hub slash) and **eDOT** (validator self-stake incentive, Hub-slashable). Operators run nodes via `StakingOperator`; they cannot move funds. In v1, stash keys sit under Orbit multisig — that is the custody boundary, not end-user self-custody of the stash.

**Spec:** [WHITEPAPER.md](./WHITEPAPER.md). If this README and the whitepaper disagree, the whitepaper wins.

Status: the full protocol loop — deposit, the eDOT mix circuit breaker, redeem — is proven end to end on a local Zombienet network, dashboard included. Orbit is also registered on **Paseo testnet** (para `2002`), but Paseo's on-demand coretime is currently broken chain-wide (tracked in [#34](https://github.com/Kanasjnr/Orbit/issues/34)), so the live deployment isn't producing blocks right now; Zombienet is the current path for hands-on testing until that clears. **Not audited. Not mainnet. Do not deposit real DOT.**

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
| `pallets/odot/` | oDOT vault pallet deposit, redeem, exchange-rate accounting |
| `pallets/edot/` | eDOT vault pallet deposit, redeem, queue, Hub slash, mix circuit breaker  |
| `pallets/hub-feed/` | Hub observation ingress: nomination/self-stake rewards + eDOT slash  |
| `pallets/hub-bridge/` | Oracle-attested Hub ↔ Orbit balance bridge: deposit-in credits, withdrawal-out requests  |
| `frontend/` | Vite + React dashboard: landing page, wallet connect, deposit/redeem against a live Orbit node |
| `chopsticks/` | Chopsticks Asset Hub fork + Hub stake lab (`hub:setup`) |
| `paseo/` | Scripts to reserve/register the para, build the chain spec, run the collator, and upgrade the live runtime |
| `scripts/` | PAPI observer, Chopsticks Hub bond/nominate setup, Paseo relay/upgrade/fund helpers, the Hub↔Orbit bridge relayer, **hub loop smoke** |

Vaults, unbond queues, `pallet-hub-feed`, the eDOT mix circuit breaker, `pallet-hub-bridge`, and the frontend are all on the trunk. Hub lab: Chopsticks `npm run hub:setup` bonds Orbit stashes on forked Asset Hub; `hub:payout` forces `Staking.Rewarded`; `npm run hub:loop` reports into Orbit and asserts oDOT/eDOT `totalAssets`. PR CI typechecks scripts and exercises synthetic `hubFeed.report*` in Zombienet. Unbond delay is still a short PoC (not Hub-aligned)

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

Build collator + relay. Linux CI downloads relay release binaries; **macOS must compile relay locally** (Parity does not ship macOS `polkadot`).

```bash
# from Orbit repo root
ORBIT_ROOT="$PWD"

# 1) Orbit collator
cargo +1.93.1 build -p parachain-template-node --release

# 2) Relay (one-time, ~30–60 min) — SDK major must match Cargo.toml (2512 → polkadot-stable2512)
git clone --depth 1 --branch polkadot-stable2512 \
  https://github.com/paritytech/polkadot-sdk.git /tmp/polkadot-sdk-2512
cd /tmp/polkadot-sdk-2512
# Rust 1.93 rejects `#[deprecated]` on type params; remove the attribute on
# `OnRuntimeUpgrade` in substrate/frame/executive/src/lib.rs if the build errors.
cargo +1.93.1 build --release -p polkadot   # emits polkadot + *-worker binaries
cp target/release/polkadot target/release/polkadot-*-worker \
  "$ORBIT_ROOT/target/release/"

# 3a) Run the automated CI check (spawns, asserts, tears down)
cd "$ORBIT_ROOT"
export PATH="$PWD/target/release:$PATH"
npx --yes @zombienet/cli --dir /tmp/zn-test --provider native test .github/tests/zombienet-integration.zndsl

# 3b) Or spawn it as a network you can actually click around against
npx --yes @zombienet/cli --dir /tmp/zn-run --provider native spawn zombienet.toml
```

For `spawn`, don't pre-create `--dir`'s target directory — Zombienet treats an already-existing directory as a stale run and blocks on an interactive `y/N` prompt, which just hangs if nothing's attached to stdin. Point Polkadot.js (or the frontend, below) at the collator's WS port from the "Network launched" output — the native provider assigns ports dynamically, so it's rarely the `ws_port` written in `zombienet.toml`. `polkadot-omni-node --dev` is not the primary path Aura slot mismatch on mock relay.

Zombienet's own relay chain and Orbit's parachain token have nothing to do with Paseo or real PAS — they're throwaway dev-only balances from genesis, pre-funded for the well-known dev accounts (Alice, Bob, …). A fresh account (a real wallet you connect with) starts at zero and needs funding by one of them; `scripts/zombienet-fund.ts` does exactly that (`tsx zombienet-fund.ts <address> [amount-in-UNIT] [ws-endpoint]`, signs from `//Alice`).

#### Testing the full deposit flow locally

Zombienet has no real Asset Hub, so the bridge's Hub-side leg has nothing to bridge from by default. To exercise the real guided deposit flow (Hub-side signature → relayer catches it → Orbit credits it → local `deposit()`) against a spawned network:

1. Fund two different accounts with `zombienet-fund.ts` — one to deposit from, and use the address already configured as `VITE_BRIDGE_RECEIVING_ACCOUNT` as the receiving side. Depositing from the receiving account itself is a real but pointless self-transfer: Substrate's balances pallet treats debiting and crediting the same account as a no-op and never emits a `Transfer` event, so the relayer has nothing to see.
2. In `frontend/`, create `.env.local` (already gitignored, sits above `.env` in Vite's precedence so it doesn't touch your real Paseo config) pointing **both** `VITE_ORBIT_WS` and `VITE_HUB_WS` at the same Zombienet collator endpoint — for this test, Orbit and "Hub" are deliberately the same chain.
3. Run the relayer against that same endpoint for both sides: `HUB_WS=<endpoint> ORBIT_WS=<endpoint> npx tsx hub-bridge-relay.ts` (from `scripts/`).
4. Use the dashboard normally from there — sign the Hub-side transfer, the relayer reports the credit, sign the local deposit.

One known gap found running this live: the relayer's deposit-watching leg has no catch-up if it misses a live event (unlike the withdrawal leg, which sweeps `PendingWithdrawals` on startup) — if a deposit sits at "waiting for Orbit to credit" for more than ~15s, the transfer likely landed but the relayer missed the notification, worth a manual check rather than assuming it'll resolve.

### Live Paseo testnet

Orbit runs as a registered parachain on Paseo (para `2002`) rather than only in a throwaway local network. Reserving/registering the para, building the chain spec, running the collator, and pushing runtime upgrades all live under `paseo/` — see [`paseo/README.md`](./paseo/README.md) for the full walkthrough, including the runtime-upgrade flow (`npm run paseo:upgrade` from `scripts/`) needed any time pallet code changes after the one-time para registration. As noted above, Paseo's on-demand coretime is currently broken chain-wide, so a synced collator won't produce blocks until that's resolved ([#34](https://github.com/Kanasjnr/Orbit/issues/34)) — Zombienet is the reliable path for now.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # point VITE_ORBIT_WS / VITE_HUB_WS at your collator and Asset Hub
npm run dev
```

The dashboard connects to Orbit directly and to Asset Hub for the deposit bridge; see [`frontend/README.md`](./frontend/README.md) for the environment variables it expects.

---

## Disclosures

Code is unaudited until a production audit lands. v1 production custody is **multisig stash + `StakingOperator`**, not “users keep the stash.” Hub slash hits **eDOT only**; oDOT is not a slash waterfall. Theft or buggy accounting can still impair either vault. Economic figures in the whitepaper (including any ~73% anecdote) are not promised APYs. The bridge relayer (`scripts/hub-bridge-relay.ts`) has a known reliability gap: its deposit-watching leg relies on a live event subscription with no replay if a notification is missed, so a deposit can land on Hub without being auto-credited on Orbit.

Full list: whitepaper §16.

# Chopsticks

Staking truth is on Polkadot Asset Hub. Vault math is on Orbit. This lab forks AH with
Chopsticks, seeds Orbit-controlled stashes (`//OrbitNom`, `//OrbitSelf`, `//OrbitOp`),
forces a payout block, then reports rewards into Orbit `hubFeed`.

## Setup

```bash
nvm use 22
cd scripts && npm install
```

## Lab flow

```bash
# 1. Fork Asset Hub (note ws URL in log, e.g. ws://127.0.0.1:8000)
cd scripts
npm exec chopsticks -- --config ../chopsticks/hub-manual.yml

# 2. Setup + payout
export HUB_WS=ws://127.0.0.1:<port>
npm run hub:lab

# 3. Watch Hub events (no Orbit)
npm run observe:dry

# 4. Feed Orbit (Zombienet charlie — use RPC from spawn output, not a fixed port)
export ORBIT_WS=ws://127.0.0.1:<charlie-rpc>
npm run hub:loop
# or, after payout: npm run hub:loop -- --skip-payout
```

Use project-local Chopsticks from `scripts/` (`>=1.5.1`). Node >= 22.

## Scripts

| npm script | file | role |
| ---------- | ---- | ---- |
| `hub:setup` | `hub-setup.ts` | bond, nominate, validate, operator proxy via `dev_setStorage` |
| `hub:payout` | `hub-payout.ts` | inject era snapshot, build payout block, print `Rewarded` |
| `hub:lab` | setup + payout | one-shot Hub lab |
| `hub:loop` | `hub-loop.ts` | payout (optional) → scan rewards → `hubFeed` → assert vault totals |
| `observe` | `hub-observe.ts` | live Hub event watcher (PAPI) |

Shared helpers: `hub.ts`.

## Notes

- `hub:setup` uses `Payee=Stash` — setStorage bonding skips balance Holds.
- `hub:payout` clears `disableMintingGuard` and syncs parent timestamp before `dev_newBlock`.
- Restart Chopsticks fresh if Aura panics or `NotEnoughFunds` after many re-runs.
- Zombienet assigns dynamic RPC ports; read charlie's ws URL from spawn output.

## Observer mapping

| Hub event | Orbit call |
| --------- | ---------- |
| `Staking.Rewarded` (nomination stash) | `hubFeed.reportNominationReward` |
| `Staking.Rewarded` (self-stake stash) | `hubFeed.reportSelfStakeReward` |
| `Staking.ValidatorIncentivePaid` | `hubFeed.reportSelfStakeReward` |
| `Staking.Slashed` (self-stake only) | `hubFeed.reportSlash` |

## Paseo

Public testnet deploy: see [`paseo/README.md`](../paseo/README.md). Reserve a para id, build spec, register, run collator, then point `hub:observe` at Paseo Asset Hub RPC and your Orbit collator.

## CI vs local

| What | Where |
| ---- | ----- |
| PAPI descriptors + `tsc` | GitHub Actions |
| Orbit `hubFeed.report*` + vault updates | Zombienet |
| Chopsticks lab | local only |

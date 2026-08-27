# Chopsticks

Orbit vault math lives on the parachain. **Staking truth is on Polkadot Asset Hub.**
This lab forks Asset Hub with Chopsticks, creates Orbit-controlled lab stashes
(`//OrbitNom`, `//OrbitSelf`), bonds + nominates on real Hub staking storage, then
feeds events into Orbit via the PAPI observer.

## Setup

```bash
nvm use 22
cd scripts && npm install
```

## Lab flow (local)

```bash
# 1. Fork Asset Hub (from repo root)
npx @acala-network/chopsticks --config chopsticks/hub-asset-hub.yml

# 2. Fund + bond + nominate Orbit lab stashes (writes hub-stashes.json)
cd scripts
HUB_WS=ws://127.0.0.1:8000 npm run hub:setup

# 3. Watch Hub events for those stashes (dry-run)
HUB_WS=ws://127.0.0.1:8000 npm run observe:dry

# 4. Optional: submit into Zombienet charlie
ORBIT_WS=ws://127.0.0.1:<charlie-rpc> HUB_WS=ws://127.0.0.1:8000 npm run observe
```

`hub:setup` uses Chopsticks `dev_setStorage` to write **balances + staking ledger /
nominator maps** for `//OrbitNom` and `//OrbitSelf`. It does **not** submit
`staking.bond` extrinsics: Chopsticks Instant on Asset Hub often panics with
`Timestamp slot must match CurrentSlot` when building blocks.

Keys are well-known SR25519 URIs (lab only).

Check ledger after setup (polkadot.js / script logs):

- `staking.ledger(OrbitNom)` / `staking.nominators(OrbitNom)`
- `staking.ledger(OrbitSelf)` — bonded; `validate` + session keys deferred (operator phase)

## Observer mapping

| Hub event | Orbit call |
| --------- | ---------- |
| `Staking.Rewarded` (nomination stash) | `hubFeed.reportNominationReward` |
| `Staking.Rewarded` (self-stake stash) | `hubFeed.reportSelfStakeReward` |
| `Staking.ValidatorIncentivePaid` | `hubFeed.reportSelfStakeReward` |
| `Staking.Slashed` (self-stake only) | `hubFeed.reportSlash` |

## CI vs local

| What | Where |
| ---- | ----- |
| PAPI descriptors + `tsc` | GitHub Actions `scripts` job |
| Orbit `hubFeed.report*` + vault updates | Zombienet `hub-feed-report.js` |
| Chopsticks bond/nominate + observe | **Local only** |

## Honest scope

- Lab stashes prove Hub staking *shapes* under Orbit control — not mainnet custody.
- Self-stake stash is bonded only; becoming an elected validator needs session keys / `StakingOperator`.
- Unbonding on Orbit remains a short PoC (10 blocks).

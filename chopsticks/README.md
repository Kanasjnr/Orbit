# Chopsticks / live Hub — real staking observation (PAPI)

Orbit vault math is on the parachain. **Staking truth is on Polkadot Asset Hub.**
The observer uses **[Polkadot API (PAPI)](https://papi.how/)** typed descriptors +
[`event.watch()`](https://papi.how/typed/events/) on finalized blocks — not a giant
historical block scan.

## Why not scan 5000 blocks?

`Staking.Rewarded` / `Slashed` / `ValidatorIncentivePaid` are sparse. Walking thousands
of blocks over public RPC is slow and usually empty. A feed should **subscribe** to new
finalized events ([PAPI providers](https://papi.how/providers), [client](https://papi.how/client)).

## Setup

```bash
nvm use 22          # PAPI WS needs Node >= 22.4
cd scripts
npm install         # runs `papi` codegen → .papi/descriptors (pah = polkadot_asset_hub)
cp hub-stashes.example.json hub-stashes.json
```

Codegen was added with ([papi codegen](https://papi.how/codegen)):

```bash
npx papi add pah -n polkadot_asset_hub
```

## Run

```bash
# Live watch (dry-run — no Orbit txs)
HUB_WS=wss://polkadot-asset-hub-rpc.polkadot.io npm run observe:dry

# Live watch + submit into Zombienet charlie
ORBIT_WS=ws://127.0.0.1:<charlie-rpc> npm run observe
```

Observer is TypeScript (`hub-feed-observe.ts`) run with `tsx`, so `@polkadot-api/descriptors` autocomplete/types match [PAPI codegen](https://papi.how/codegen).

Watches ([typed events](https://papi.how/typed/events/), [runtime APIs](https://papi.how/typed/apis)):

| Hub event | Orbit call |
| --------- | ---------- |
| `Staking.Rewarded` (mapped nomination stash) | `hubFeed.reportNominationReward` |
| `Staking.Rewarded` (mapped self-stake stash) | `hubFeed.reportSelfStakeReward` |
| `Staking.ValidatorIncentivePaid` | `hubFeed.reportSelfStakeReward` |
| `Staking.Slashed` (self-stake only) | `hubFeed.reportSlash` |

## CI vs local

| What | Where |
| ---- | ----- |
| PAPI descriptors + `tsc` | GitHub Actions `scripts` job (Node 22, no live Hub) |
| Orbit `hubFeed.report*` + vault updates + dedup | Zombienet job (`hub-feed-report.js` on charlie) |
| Chopsticks Hub fork + `hub-feed-observe.ts` | **Local only** for now (public Hub / long sync is too flaky for PR CI) |

Local end-to-end once Zombienet charlie is up:

```bash
npx @acala-network/chopsticks --config chopsticks/hub-asset-hub.yml
# other terminal:
HUB_WS=ws://127.0.0.1:8000 ORBIT_WS=ws://127.0.0.1:<charlie-rpc> npm run observe
```

## Honest scope

- Real Hub event shapes → Orbit vault updates.
- Until Orbit owns Hub stashes, `hub-stashes.json` may hold public validators for plumbing only.
- Unbonding on Orbit remains a short PoC (10 blocks).

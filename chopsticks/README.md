# Chopsticks — Hub-shaped staking fork

Orbit’s vault math lives on the parachain. Hub staking still lives on Polkadot / Asset Hub.
Chopsticks forks live Hub state so a feed process can **observe** nomination rewards,
self-stake rewards, and slashes, then submit them into `pallet-hub-feed` on Orbit.

## Layout

| File | Role |
| ---- | ---- |
| `hub-polkadot.yml` | Example Chopsticks config forking Polkadot (adjust endpoint / block) |
| `../scripts/hub-feed-report.example.js` | Example: build a `hub_event_id` and call `hubFeed.report*` |

## Flow

1. Run Chopsticks against a Hub endpoint (or recorded snapshot).
2. Read staking-related storage / events for Orbit’s validator stashes.
3. Attribute amounts:
   - nomination rewards → `hubFeed.reportNominationReward`
   - self-stake / incentive → `hubFeed.reportSelfStakeReward`
   - self-stake slash → `hubFeed.reportSlash` (eDOT only)
4. Use a stable `hub_event_id` (e.g. blake2 of block hash + event index) so retries are idempotent.

PoC `FeedOrigin` is `Root` / sudo. Production should use a dedicated oracle origin.

This does **not** replace Zombienet CI. Chopsticks is for Hub storage shape fidelity; Zombienet proves the Orbit parachain + vault extrinsics.

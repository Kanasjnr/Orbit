# Pallets

ℹ️ A pallet is a unit of encapsulated logic, with a clearly defined responsibility. A pallet is analogous to a
module in the runtime.

💁 **oDOT** (`pallets/odot/`) — nomination vault (WHITEAPER §9). No Hub slash path (§10.1A). Instant redeem = buffer path; protocol redeem queues for `UnbondingPeriod`.

💁 **eDOT** (`pallets/edot/`) — self-stake vault + Hub slash (§9–10). Protocol redeem is queued (shares stay in `S` until claim).

💁 **Hub feed** (`pallets/hub-feed/`) — observed Hub events → oDOT nomination rewards, eDOT self-stake rewards, eDOT slash only. Dedups on `hub_event_id`. Chopsticks PoC under `chopsticks/`.

👉 Learn more about FRAME
[here](https://paritytech.github.io/polkadot-sdk/master/polkadot_sdk_docs/polkadot_sdk/frame_runtime/index.html).

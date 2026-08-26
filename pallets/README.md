# Pallets

ℹ️ A pallet is a unit of encapsulated logic, with a clearly defined responsibility. A pallet is analogous to a
module in the runtime.

💁 **oDOT** (`pallets/odot/`) — nomination vault share accounting (WHITEPAPER §9). No Hub slash path (§10.1A). Unit tests use a minimal mock runtime; Hub staking is Zombienet/Chopsticks later.

💁 **eDOT** (`pallets/edot/`) — validator self-stake vault share accounting (WHITEPAPER §9) plus Hub slash socialization (§10.1A / §9.4). Same V/S mint/redeem math as oDOT; `apply_slash` reduces V without burning shares.

👉 Learn more about FRAME
[here](https://paritytech.github.io/polkadot-sdk/master/polkadot_sdk_docs/polkadot_sdk/frame_runtime/index.html).

🧑‍🏫 Please refer to
[this guide](https://paritytech.github.io/polkadot-sdk/master/polkadot_sdk_docs/guides/your_first_pallet/index.html)
to learn how to write a basic pallet.

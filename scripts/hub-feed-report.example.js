// Example only wire to your Chopsticks / indexer session.
// Submits a nomination reward into pallet-hub-feed (sudo/root in PoC).
//
// Usage sketch (polkadot.js against Orbit collator WS):
//   node scripts/hub-feed-report.example.js
//
// Replace connect URL, signing, and hub_event_id derivation with real Hub observation.

const { ApiPromise, WsProvider } = require("@polkadot/api");
const { Keyring } = require("@polkadot/keyring");
const { blake2AsU8a } = require("@polkadot/util-crypto");

async function main() {
	const provider = new WsProvider(process.env.ORBIT_WS || "ws://127.0.0.1:9944");
	const api = await ApiPromise.create({ provider });
	await api.isReady;

	const keyring = new Keyring({ type: "sr25519" });
	const sudo = keyring.addFromUri("//Alice");

	// Stable id: hash(blockHash || era || kind || amount)must be unique per Hub event.
	const era = 1;
	const amount = 1_000_000_000n; // 1 milli-unit example
	const hubEventId = blake2AsU8a(
		Uint8Array.from(Buffer.from(`nom-reward|${era}|${amount.toString()}`)),
		256,
	);

	const tx = api.tx.hubFeed.reportNominationReward(hubEventId, era, amount);
	const sudoTx = api.tx.sudo.sudo(tx);

	await new Promise((resolve, reject) => {
		sudoTx.signAndSend(sudo, ({ status, dispatchError }) => {
			if (dispatchError) {
				reject(new Error(dispatchError.toString()));
			} else if (status.isFinalized) {
				resolve();
			}
		});
	});

	console.log("reported nomination reward", { era, amount: amount.toString() });
	await api.disconnect();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

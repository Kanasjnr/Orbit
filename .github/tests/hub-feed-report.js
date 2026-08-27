// Zombienet: Alice (HubFeedOracle) reports Hub outcomes into hub-feed on charlie.
// Covers nomination → oDOT, self-stake → eDOT, slash → eDOT, and dedup storage.
// Returns 1 on success (zndsl expects > 0).

const MILLI_UNIT = 1_000_000_000n;

function send(api, pair, call) {
	return new Promise((resolve, reject) => {
		let unsub = () => {};
		call
			.signAndSend(pair, (result) => {
				if (result.dispatchError) {
					let msg = result.dispatchError.toString();
					if (result.dispatchError.isModule) {
						const meta = api.registry.findMetaError(result.dispatchError.asModule);
						msg = `${meta.section}.${meta.name}`;
					}
					unsub();
					reject(new Error(msg));
				} else if (result.status.isFinalized) {
					unsub();
					resolve(result.status.asFinalized.toHex());
				}
			})
			.then((u) => {
				unsub = u;
			})
			.catch(reject);
	});
}

function eventId(label) {
	const bytes = new Uint8Array(32);
	bytes.set(new TextEncoder().encode(label).slice(0, 32));
	return Array.from(bytes);
}

async function run(nodeName, networkInfo, _jsArgs) {
	const { wsUri, userDefinedTypes } = networkInfo.nodesByName[nodeName];
	const api = await zombie.connect(wsUri, userDefinedTypes);
	await zombie.util.cryptoWaitReady();

	if (!api.tx.hubFeed) throw new Error("hubFeed pallet missing");

	const alice = new zombie.Keyring({ type: "sr25519" }).addFromUri("//Alice");
	const era = 1;
	const reward = 5n * MILLI_UNIT;
	const slash = 1n * MILLI_UNIT;

	const odotBefore = BigInt((await api.query.odot.totalAssets()).toString());
	const edotBefore = BigInt((await api.query.edot.totalAssets()).toString());

	const nomId = eventId("zn-nom-reward-v1");
	await send(api, alice, api.tx.hubFeed.reportNominationReward(nomId, era, reward));
	const odotAfter = BigInt((await api.query.odot.totalAssets()).toString());
	if (odotAfter !== odotBefore + reward) {
		throw new Error(`odot totalAssets ${odotAfter} != ${odotBefore + reward}`);
	}

	const selfId = eventId("zn-self-reward-v1");
	await send(api, alice, api.tx.hubFeed.reportSelfStakeReward(selfId, era, reward));
	const edotAfterSelf = BigInt((await api.query.edot.totalAssets()).toString());
	if (edotAfterSelf !== edotBefore + reward) {
		throw new Error(`edot totalAssets ${edotAfterSelf} != ${edotBefore + reward}`);
	}

	const slashId = eventId("zn-slash-v1");
	await send(api, alice, api.tx.hubFeed.reportSlash(slashId, era, slash));
	const edotAfterSlash = BigInt((await api.query.edot.totalAssets()).toString());
	if (edotAfterSlash !== edotAfterSelf - slash) {
		throw new Error(`edot after slash ${edotAfterSlash} != ${edotAfterSelf - slash}`);
	}

	// Dedup: id is marked processed (avoids a 4th ~45s finalization in CI).
	const seen = await api.query.hubFeed.processedHubEvents(nomId);
	if (seen.isNone) throw new Error("expected ProcessedHubEvents for nomination id");

	return 1;
}

module.exports = { run };

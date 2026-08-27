// Zombienet: Alice (HubFeedOracle) reports Hub outcomes into hub-feed on charlie.
// Covers nomination reward → oDOT, self-stake reward → eDOT, slash → eDOT, dedup.
// Returns 1 on success (zndsl expects > 0).

const MILLI_UNIT = 1_000_000_000n;

function send(api, pair, call) {
	return new Promise((resolve, reject) => {
		call.signAndSend(pair, (result) => {
			if (result.dispatchError) {
				let msg = result.dispatchError.toString();
				if (result.dispatchError.isModule) {
					const meta = api.registry.findMetaError(result.dispatchError.asModule);
					msg = `${meta.section}.${meta.name}`;
				}
				reject(new Error(msg));
			} else if (result.status.isFinalized) {
				resolve(result.status.asFinalized.toHex());
			}
		}).catch(reject);
	});
}

function eventId(label) {
	// 32-byte id; pad a short label so each report in this script is unique.
	const bytes = new Uint8Array(32);
	const enc = new TextEncoder().encode(label);
	bytes.set(enc.slice(0, 32));
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
	const odotAfterNom = BigInt((await api.query.odot.totalAssets()).toString());
	if (odotAfterNom !== odotBefore + reward) {
		throw new Error(`odot totalAssets ${odotAfterNom} != ${odotBefore + reward}`);
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

	// Same hub_event_id must be rejected (dedup).
	let dedupOk = false;
	try {
		await send(api, alice, api.tx.hubFeed.reportNominationReward(nomId, era, reward));
	} catch (e) {
		if (String(e.message || e).includes("DuplicateHubEvent")) dedupOk = true;
		else throw e;
	}
	if (!dedupOk) throw new Error("expected DuplicateHubEvent on re-report");

	return 1;
}

module.exports = { run };

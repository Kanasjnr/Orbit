/**
 * Watch Asset Hub staking events (PAPI) and report into Orbit hub-feed.
 *
 *   cd scripts && npm install
 *   npm run observe:dry
 *   ORBIT_WS=ws://127.0.0.1:<port> npm run observe
 *
 * Stashes: hub-stashes.json (see hub-stashes.example.json)
 * Hub WS:  https://papi.how/providers/ws/
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blake2b } from "@noble/hashes/blake2b";
import { pah } from "@polkadot-api/descriptors";
import type { BlockInfo } from "polkadot-api";
import { createWsClient } from "polkadot-api/ws";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import { WebSocket } from "ws";

const dir = path.dirname(fileURLToPath(import.meta.url));

const hubWs = process.env.HUB_WS ?? "wss://polkadot-asset-hub-rpc.polkadot.io";
const orbitWs = process.env.ORBIT_WS ?? "ws://127.0.0.1:9944";
const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
const dumpAll = process.argv.includes("--dump-all");
const stashFile =
	process.env.HUB_STASHES ??
	(fs.existsSync(path.join(dir, "hub-stashes.json"))
		? path.join(dir, "hub-stashes.json")
		: path.join(dir, "hub-stashes.example.json"));


const stashJson = JSON.parse(fs.readFileSync(stashFile, "utf8")) as {
	nominationStashes?: string[];
	selfStakeStashes?: string[];
};
const nomination = new Set(stashJson.nominationStashes ?? []);
const selfStake = new Set(stashJson.selfStakeStashes ?? []);


function eventId(blockHash: string, index: number, kind: string, amount: bigint) {
	const head = Buffer.from(blockHash.replace(/^0x/, ""), "hex");
	const tail = Buffer.from(`|${index}|${kind}|${amount}`);
	return blake2b(Buffer.concat([head, tail]), { dkLen: 32 });
}

function extrinsicIndex(ev: { original?: { phase?: { type: string; value?: number } } }, fallback: number) {
	const phase = ev.original?.phase;
	return phase?.type === "ApplyExtrinsic" ? (phase.value ?? fallback) : fallback;
}

async function connectOrbit() {
	const api = await ApiPromise.create({
		provider: new WsProvider(orbitWs, 2_500, {}, 15_000),
		throwOnConnect: true,
	});
	await api.isReadyOrError;
	if (!api.tx.hubFeed) throw new Error(`no hubFeed pallet at ${orbitWs}`);
	return api;
}

function signAndWait(api: ApiPromise, pair: ReturnType<Keyring["addFromUri"]>, call: any) {
	return new Promise<string>((resolve, reject) => {
		call.signAndSend(pair, ({ status, dispatchError }: any) => {
			if (dispatchError) {
				if (dispatchError.isModule) {
					const m = api.registry.findMetaError(dispatchError.asModule);
					reject(new Error(`${m.section}.${m.name}`));
				} else {
					reject(new Error(dispatchError.toString()));
				}
			} else if (status.isFinalized) {
				resolve(status.asFinalized.toHex());
			}
		});
	});
}


async function main() {
	console.log(`stashes ${stashFile}  nom=${nomination.size} self=${selfStake.size}  dry=${dryRun}`);
	console.log(`hub ${hubWs}`);

	const client = createWsClient(hubWs, { websocketClass: WebSocket as any });
	const hub = client.getTypedApi(pah);

	let era = (await hub.query.Staking.ActiveEra.getValue())?.index ?? 0;
	console.log(`activeEra ${era}`);

	const orbit = dryRun ? null : await connectOrbit();
	const oracle = dryRun
		? null
		: new Keyring({ type: "sr25519" }).addFromUri(process.env.ORBIT_ORACLE_URI ?? "//Alice");
	if (orbit) console.log(`orbit ${orbitWs}`);

	const stats = { nom: 0, self: 0, slash: 0, skip: 0, ok: 0 };

	async function report(
		kind: "nom-reward" | "self-reward" | "slash",
		account: string,
		amount: bigint,
		block: BlockInfo,
		index: number,
		eraOverride?: number,
	) {
		if (amount === 0n) {
			stats.skip++;
			return;
		}
		if (kind === "slash") stats.slash++;
		else if (kind === "nom-reward") stats.nom++;
		else stats.self++;

		const useEra = eraOverride ?? era;
		const id = eventId(block.hash, index, kind, amount);
		console.log(
			`[${dryRun ? "dry" : "tx"}] #${block.number}[${index}] ${kind} ${account} ${amount} era=${useEra}`,
		);

		if (!orbit || !oracle) return;

		const bytes = Array.from(id);
		const tx =
			kind === "slash"
				? orbit.tx.hubFeed.reportSlash(bytes, useEra, amount)
				: kind === "nom-reward"
					? orbit.tx.hubFeed.reportNominationReward(bytes, useEra, amount)
					: orbit.tx.hubFeed.reportSelfStakeReward(bytes, useEra, amount);

		try {
			console.log(`  finalized ${await signAndWait(orbit, oracle, tx)}`);
			stats.ok++;
		} catch (e: any) {
			const msg = e?.message ?? String(e);
			if (msg.includes("DuplicateHubEvent")) console.log("  dedup");
			else console.error(`  fail ${msg}`);
		}
	}

	async function onRewarded(block: BlockInfo, events: any[]) {
		for (const [i, ev] of events.entries()) {
			const { stash, amount } = ev.payload;
			const idx = extrinsicIndex(ev, i);
			if (nomination.has(stash)) await report("nom-reward", stash, amount, block, idx);
			else if (selfStake.has(stash)) await report("self-reward", stash, amount, block, idx);
			else {
				stats.skip++;
				if (dumpAll) console.log(`[skip] #${block.number} reward ${stash} ${amount}`);
			}
		}
	}

	async function onSlashed(block: BlockInfo, events: any[]) {
		for (const [i, ev] of events.entries()) {
			const { staker, amount } = ev.payload;
			if (!selfStake.has(staker)) {
				stats.skip++;
				if (dumpAll) console.log(`[skip] #${block.number} slash ${staker} ${amount}`);
				continue;
			}
			await report("slash", staker, amount, block, extrinsicIndex(ev, i));
		}
	}

	async function onIncentive(block: BlockInfo, events: any[]) {
		for (const [i, ev] of events.entries()) {
			const { validator_stash, amount, era: paidEra } = ev.payload;
			if (!selfStake.has(validator_stash)) {
				stats.skip++;
				if (dumpAll) console.log(`[skip] #${block.number} incentive ${validator_stash} ${amount}`);
				continue;
			}
			await report("self-reward", validator_stash, amount, block, extrinsicIndex(ev, i), paidEra);
		}
	}

	console.log("watching Rewarded / Slashed / ValidatorIncentivePaid )");

	const subs = [
		hub.event.Staking.Rewarded.watch().subscribe(({ block, events }: { block: BlockInfo; events: any[] }) => {
			if (!events.length) return;
			void hub.query.Staking.ActiveEra.getValue().then((v: { index: number } | undefined) => {
				if (v?.index != null) era = v.index;
			});
			void onRewarded(block, events);
		}),
		hub.event.Staking.Slashed.watch().subscribe(({ block, events }: { block: BlockInfo; events: any[] }) => {
			if (!events.length) return;
			void onSlashed(block, events);
		}),
		hub.event.Staking.ValidatorIncentivePaid.watch().subscribe(
			({ block, events }: { block: BlockInfo; events: any[] }) => {
				if (!events.length) return;
				void onIncentive(block, events);
			},
		),
	];

	const stop = async () => {
		console.log("stop", stats);
		for (const s of subs) s.unsubscribe();
		client.destroy();
		if (orbit) await orbit.disconnect();
		process.exit(0);
	};
	process.on("SIGINT", () => void stop());
	process.on("SIGTERM", () => void stop());
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

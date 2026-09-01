/**
 * WP1 smoke: Chopsticks payout → hub-feed reports → oDOT/eDOT totalAssets rise.
 *
 *   # terminal A: chopsticks
 *   # terminal B: zombienet (or any Orbit node with hubFeed + Alice oracle)
 *   cd scripts
 *   HUB_WS=ws://127.0.0.1:8000 ORBIT_WS=ws://127.0.0.1:9944 npm run hub:loop
 *
 * Set DRY_RUN=1 to scan Hub rewards without submitting Orbit txs.
 */

import { ApiPromise, WsProvider } from "@polkadot/api";
import {
	connectOrbit,
	hubFeedOracle,
	loadStashes,
	readVaultTotals,
	reportToOrbit,
	scanBlockRewards,
} from "./hub-feed-lib.js";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const hubWs = process.env.HUB_WS ?? "ws://127.0.0.1:8000";
const orbitWs = process.env.ORBIT_WS ?? "ws://127.0.0.1:9944";
const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
const skipPayout = process.argv.includes("--skip-payout");

async function runPayoutLab() {
	execSync("npx tsx hub-payout-lab.ts", {
		cwd: dir,
		stdio: "inherit",
		env: { ...process.env, HUB_WS: hubWs },
	});
}

async function latestBlockHash(provider: WsProvider): Promise<string> {
	const api = await ApiPromise.create({ provider, throwOnConnect: true });
	await api.isReadyOrError;
	const hash = (await api.rpc.chain.getHeader()).hash.toHex();
	await api.disconnect();
	return hash;
}

async function main() {
	const stashes = loadStashes();
	console.log(`hub ${hubWs}  orbit ${orbitWs}  dry=${dryRun}`);

	const orbit = dryRun ? null : await connectOrbit(orbitWs);
	const oracle = dryRun ? null : hubFeedOracle();

	const before = orbit ? await readVaultTotals(orbit) : null;
	if (before) console.log(`before odot=${before.odot} edot=${before.edot}`);

	if (!skipPayout) {
		await runPayoutLab();
	}

	const provider = new WsProvider(hubWs, 5_000, {}, 60_000);
	const blockHash = await latestBlockHash(provider);
	const hub = await ApiPromise.create({ provider, throwOnConnect: true });
	await hub.isReadyOrError;

	const rewards = await scanBlockRewards(hub, blockHash, stashes);
	if (rewards.length === 0) {
		throw new Error("no lab Rewarded events on latest block — run hub:payout or hub:loop without --skip-payout");
	}

	const era = Number(((await hub.query.staking.activeEra()) as any).unwrapOrDefault().index);
	let nomReported = 0n;
	let selfReported = 0n;
	const stats = { ok: 0, dedup: 0, dry: 0, fail: 0 };

	for (const ev of rewards) {
		if (!orbit || !oracle) {
			stats.dry++;
			console.log(`[dry] would report ${ev.kind} ${ev.amount} for ${ev.stash}`);
			if (ev.kind === "nom-reward") nomReported += ev.amount;
			else selfReported += ev.amount;
			continue;
		}
		const res = await reportToOrbit(
			orbit,
			oracle,
			ev.kind,
			ev.stash,
			ev.amount,
			ev.blockHash,
			ev.index,
			ev.era ?? era,
			false,
		);
		stats[res === "ok" || res === "dedup" ? res : "fail"]++;
		if (res === "ok") {
			if (ev.kind === "nom-reward") nomReported += ev.amount;
			else selfReported += ev.amount;
		}
	}

	if (orbit && before) {
		const after = await readVaultTotals(orbit);
		console.log(`after  odot=${after.odot} edot=${after.edot}`);
		console.log(`stats ${JSON.stringify(stats)}`);

		if (nomReported > 0n && after.odot !== before.odot + nomReported) {
			throw new Error(`odot totalAssets ${after.odot} != ${before.odot + nomReported}`);
		}
		if (selfReported > 0n && after.edot !== before.edot + selfReported) {
			throw new Error(`edot totalAssets ${after.edot} != ${before.edot + selfReported}`);
		}
		console.log("hub → orbit loop OK");
	}

	await hub.disconnect();
	if (orbit) await orbit.disconnect();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

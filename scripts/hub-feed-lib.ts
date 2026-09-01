/**
 * Shared Hub → Orbit hub-feed helpers (observe, payout lab, loop smoke).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blake2b } from "@noble/hashes/blake2b";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";

const dir = path.dirname(fileURLToPath(import.meta.url));

export const MILLI_UNIT = 1_000_000_000n;
export const DOT = 10n ** 10n;

export type StashConfig = {
	nominationStashes?: string[];
	selfStakeStashes?: string[];
	nominateTargets?: string[];
	hubWs?: string;
};

export type HubRewardEvent = {
	kind: "nom-reward" | "self-reward";
	stash: string;
	amount: bigint;
	era?: number;
	blockHash: string;
	blockNumber: number;
	index: number;
};

export function defaultStashFile(): string {
	const local = path.join(dir, "hub-stashes.json");
	return fs.existsSync(local) ? local : path.join(dir, "hub-stashes.example.json");
}

export function loadStashes(file = process.env.HUB_STASHES ?? defaultStashFile()): StashConfig {
	return JSON.parse(fs.readFileSync(file, "utf8")) as StashConfig;
}

export function eventId(blockHash: string, index: number, kind: string, amount: bigint): Uint8Array {
	const head = Buffer.from(blockHash.replace(/^0x/, ""), "hex");
	const tail = Buffer.from(`|${index}|${kind}|${amount}`);
	return blake2b(Buffer.concat([head, tail]), { dkLen: 32 });
}

export async function connectOrbit(orbitWs: string): Promise<ApiPromise> {
	const api = await ApiPromise.create({
		provider: new WsProvider(orbitWs, 2_500, {}, 15_000),
		throwOnConnect: true,
	});
	await api.isReadyOrError;
	if (!api.tx.hubFeed) throw new Error(`no hubFeed pallet at ${orbitWs}`);
	return api;
}

export function hubFeedOracle(): ReturnType<Keyring["addFromUri"]> {
	return new Keyring({ type: "sr25519" }).addFromUri(process.env.ORBIT_ORACLE_URI ?? "//Alice");
}

export async function signAndWait(
	api: ApiPromise,
	pair: ReturnType<Keyring["addFromUri"]>,
	call: any,
): Promise<string> {
	return new Promise((resolve, reject) => {
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

export async function reportToOrbit(
	orbit: ApiPromise,
	oracle: ReturnType<Keyring["addFromUri"]>,
	kind: "nom-reward" | "self-reward" | "slash",
	account: string,
	amount: bigint,
	blockHash: string,
	index: number,
	era: number,
	dryRun: boolean,
): Promise<"ok" | "dedup" | "dry" | "fail"> {
	if (amount === 0n) return "fail";

	const id = Array.from(eventId(blockHash, index, kind, amount));
	if (dryRun) {
		console.log(`[dry] ${kind} ${account} ${amount} era=${era} block=${blockHash.slice(0, 10)}…`);
		return "dry";
	}

	const tx =
		kind === "slash"
			? orbit.tx.hubFeed.reportSlash(id, era, amount)
			: kind === "nom-reward"
				? orbit.tx.hubFeed.reportNominationReward(id, era, amount)
				: orbit.tx.hubFeed.reportSelfStakeReward(id, era, amount);

	try {
		const hash = await signAndWait(orbit, oracle, tx);
		console.log(`  orbit ${kind} finalized ${hash}`);
		return "ok";
	} catch (e: any) {
		const msg = e?.message ?? String(e);
		if (msg.includes("DuplicateHubEvent")) {
			console.log(`  dedup ${kind}`);
			return "dedup";
		}
		console.error(`  fail ${kind}: ${msg}`);
		return "fail";
	}
}

/** Scan a finalized block for Staking.Rewarded events matching lab stashes. */
export async function scanBlockRewards(
	api: ApiPromise,
	blockHash: string,
	stashes: StashConfig,
): Promise<HubRewardEvent[]> {
	const header = await api.rpc.chain.getHeader(blockHash);
	const blockNumber = header.number.toNumber();
	const events = await api.query.system.events.at(blockHash);
	const nomination = new Set(stashes.nominationStashes ?? []);
	const selfStake = new Set(stashes.selfStakeStashes ?? []);
	const activeIdx = Number(((await api.query.staking.activeEra()) as any).unwrapOrDefault().index);
	// Rewards paid for the most recently completed era.
	const payoutEra = activeIdx > 0 ? activeIdx - 1 : 0;
	const out: HubRewardEvent[] = [];

	for (const [idx, record] of events.entries()) {
		const { event, phase } = record;
		if (event.section !== "staking" || event.method !== "Rewarded") continue;

		const [stash, amountRaw] = event.data as unknown as [{ toString(): string }, { toString(): string }];
		const stashStr = stash.toString();
		const amount = BigInt(amountRaw.toString());
		const extrinsicIdx =
			phase.isApplyExtrinsic ? phase.asApplyExtrinsic.toNumber() : idx;

		if (nomination.has(stashStr)) {
			out.push({
				kind: "nom-reward",
				stash: stashStr,
				amount,
				era: payoutEra,
				blockHash,
				blockNumber,
				index: extrinsicIdx,
			});
		} else if (selfStake.has(stashStr)) {
			out.push({
				kind: "self-reward",
				stash: stashStr,
				amount,
				era: payoutEra,
				blockHash,
				blockNumber,
				index: extrinsicIdx,
			});
		}
	}

	return out;
}

export async function readVaultTotals(orbit: ApiPromise): Promise<{ odot: bigint; edot: bigint }> {
	const odot = BigInt((await orbit.query.odot.totalAssets()).toString());
	const edot = BigInt((await orbit.query.edot.totalAssets()).toString());
	return { odot, edot };
}

/**
 * Force Staking.Rewarded events for Orbit lab stashes on Chopsticks Asset Hub.
 *
 * Injects a minimal completed-era snapshot (ErasValidatorReward, ErasRewardPoints,
 * ErasStakersOverview, ErasStakersPaged), syncs block time, builds one block with
 * `staking.payoutStakers`, then scans events.
 *
 * Prereq: Chopsticks + `npm run hub:setup` (hub-stashes.json with targets).
 *
 *   HUB_WS=ws://127.0.0.1:8001 npm run hub:payout
 */

import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import {
	DOT,
	loadStashes,
	scanBlockRewards,
	type StashConfig,
} from "./hub-feed-lib.js";

const hubWs = process.env.HUB_WS ?? "ws://127.0.0.1:8000";
const rewardDot = BigInt(process.env.HUB_PAYOUT_DOT ?? "10");
const rewardAmount = rewardDot * DOT;

type ValidatorExposure = {
	validator: string;
	own: bigint;
	nominators: Array<[string, bigint]>;
};

async function rpc(provider: WsProvider, method: string, params: unknown[] = []) {
	return provider.send(method, params);
}

async function syncBlockTime(provider: WsProvider) {
	const now = Date.now();
	try {
		await rpc(provider, "dev_setBlockTime", [now]);
	} catch {
		// Older chopsticks builds may omit dev_setBlockTime; dev_newBlock may still work.
	}
}

/** Completed-era staking snapshot for `payoutStakers(validator, era)`. */
function labPayoutStorage(
	labEra: number,
	nextEra: number,
	start: number,
	validators: ValidatorExposure[],
	eraPayout: bigint,
) {
	const individual: Array<[string, number]> = [];
	const overview: unknown[] = [];
	const paged: unknown[] = [];

	for (const v of validators) {
		individual.push([v.validator, 1000]);
		const nomTotal = v.nominators.reduce((acc, [, value]) => acc + value, 0n);
		const total = v.own + nomTotal;
		const pageCount = v.nominators.length > 0 ? 1 : 0;

		overview.push([
			[labEra, v.validator],
			{
				total: total.toString(),
				own: v.own.toString(),
				nominator_count: v.nominators.length,
				page_count: pageCount,
			},
		]);

		if (pageCount > 0) {
			paged.push([
				[labEra, v.validator, 0],
				{
					page_total: nomTotal.toString(),
					others: v.nominators.map(([who, value]) => ({ who, value: value.toString() })),
				},
			]);
		}
	}

	return {
		Staking: {
			ActiveEra: { index: nextEra, start: start + 1_000 },
			CurrentEra: nextEra,
			ErasValidatorReward: [[[labEra], eraPayout.toString()]],
			ErasRewardPoints: [
				[
					[labEra],
					{
						total: individual.length * 1000,
						individual,
					},
				],
			],
			ErasStakersOverview: overview,
			ErasStakersPaged: paged,
		},
	};
}

async function injectPayoutShape(
	provider: WsProvider,
	stashes: StashConfig,
	nomBond: bigint,
	selfBond: bigint,
) {
	const api = await ApiPromise.create({ provider, throwOnConnect: true });
	await api.isReadyOrError;

	const active = (await api.query.staking.activeEra()) as any;
	const activeIdx = Number(active.unwrapOrDefault().index);
	// Completed era we will pay out; bump ActiveEra so `labEra` is in history.
	const labEra = activeIdx;
	const nextEra = labEra + 1;
	const start = Number(active.unwrapOrDefault().start ?? 0);

	const nom = stashes.nominationStashes?.[0];
	const self = stashes.selfStakeStashes?.[0];
	const target = stashes.nominateTargets?.[0];
	if (!nom || !self) throw new Error("hub-stashes.json missing OrbitNom/OrbitSelf — run hub:setup");
	if (!target) throw new Error("hub-stashes.json missing nominateTargets — run hub:setup");

	const validators: ValidatorExposure[] = [
		{ validator: target, own: 50n * DOT, nominators: [[nom, nomBond]] },
		{ validator: self, own: selfBond, nominators: [] },
	];

	// Shared era pool; reward points split it between validators in payoutStakers.
	const eraPayout = rewardAmount * BigInt(validators.length);
	const storage = labPayoutStorage(labEra, nextEra, start, validators, eraPayout);

	await rpc(provider, "dev_setStorage", [storage]);
	await api.disconnect();
	return { era: labEra, target, nom, self };
}

async function buildPayoutBlock(provider: WsProvider, era: number, validators: string[]) {
	await syncBlockTime(provider);

	const api = await ApiPromise.create({ provider, throwOnConnect: true });
	await api.isReadyOrError;

	const payer = new Keyring({ type: "sr25519" }).addFromUri(process.env.HUB_PAYER_URI ?? "//Alice");
	await rpc(provider, "dev_setStorage", [
		{
			System: {
				Account: [[[payer.address], { providers: 1, data: { free: (1000n * DOT).toString() } }]],
			},
		},
	]);

	const signed = await Promise.all(
		validators.map((validator) => api.tx.staking.payoutStakers(validator, era).signAsync(payer)),
	);

	await rpc(provider, "dev_newBlock", [{ count: 1, transactions: signed.map((u) => u.toHex()) }]);

	const hash = (await api.rpc.chain.getHeader()).hash.toHex();
	await api.disconnect();
	return hash;
}

async function main() {
	console.log(`hub ${hubWs}`);
	const stashes = loadStashes();
	if ((stashes.nominationStashes?.length ?? 0) === 0) {
		throw new Error("empty nominationStashes — run `npm run hub:setup` against Chopsticks first");
	}

	const provider = new WsProvider(hubWs, 5_000, {}, 60_000);
	const nomBond = BigInt(process.env.HUB_NOM_BOND_DOT ?? "500") * DOT;
	const selfBond = BigInt(process.env.HUB_SELF_BOND_DOT ?? "12000") * DOT;

	const { era, target, nom, self } = await injectPayoutShape(
		provider,
		stashes,
		nomBond,
		selfBond,
	);
	console.log(`era ${era} payout shape for nom ${nom} → ${target} and self ${self}`);
	console.log(`reward ${rewardDot} DOT (${rewardAmount} planck) each path`);

	const blockHash = await buildPayoutBlock(provider, era, [target, self]);
	console.log(`built block ${blockHash}`);

	const api = await ApiPromise.create({ provider, throwOnConnect: true });
	await api.isReadyOrError;
	const rewards = await scanBlockRewards(api, blockHash, stashes);
	if (rewards.length === 0) {
		throw new Error(
			"no Staking.Rewarded for lab stashes in payout block — try Manual build mode or check chopsticks logs",
		);
	}
	for (const r of rewards) {
		console.log(
			`Rewarded ${r.kind} stash=${r.stash} amount=${r.amount} block=#${r.blockNumber}[${r.index}]`,
		);
	}
	console.log(`next: ORBIT_WS=ws://127.0.0.1:<charlie-port> npm run hub:loop`);

	await api.disconnect();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

/**
 * Lab Hub staking setup against Chopsticks Asset Hub (§17.1 #2).
 *
 * Injects Orbit lab stashes into Hub staking storage via Chopsticks
 * `dev_setStorage` (bond + nominate shapes). We avoid live extrinsics here:
 * Asset Hub + Chopsticks Instant often panics on Aura timestamp/slot when
 * building blocks — see chopsticks logs "Timestamp slot must match CurrentSlot".
 *
 *   # terminal A
 *   npx @acala-network/chopsticks --config chopsticks/hub-asset-hub.yml
 *   # terminal B — use the port from the log (8000 or 8001)
 *   cd scripts && HUB_WS=ws://127.0.0.1:8001 npm run hub:setup
 *
 * Writes hub-stashes.json for hub-feed-observe.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";

const dir = path.dirname(fileURLToPath(import.meta.url));
const hubWs = process.env.HUB_WS ?? "ws://127.0.0.1:8000";
const outFile = process.env.HUB_STASHES ?? path.join(dir, "hub-stashes.json");
const nominateCount = Number(process.env.HUB_NOMINATE_COUNT ?? 4);

const DOT = 10n ** 10n;
const fundAmount = BigInt(process.env.HUB_FUND_DOT ?? "100000") * DOT;
const nomBond = BigInt(process.env.HUB_NOM_BOND_DOT ?? "500") * DOT;
const selfBond = BigInt(process.env.HUB_SELF_BOND_DOT ?? "12000") * DOT;

const NOM_URI = process.env.HUB_NOM_URI ?? "//OrbitNom";
const SELF_URI = process.env.HUB_SELF_URI ?? "//OrbitSelf";

async function setStorage(provider: WsProvider, storage: Record<string, unknown>) {
	await provider.send("dev_setStorage", [storage]);
}

async function pickValidators(api: ApiPromise): Promise<string[]> {
	// session.validators is a small Vec — never page ErasStakers* on a live fork.
	const session = (await api.query.session.validators()) as unknown as Array<{ toString(): string }>;
	const list = session.map((a) => a.toString()).slice(0, nominateCount);
	if (list.length > 0) return list;

	const active = (await api.query.staking.activeEra()) as any;
	const era = Number(active.unwrapOrDefault().index);
	const prefs = await api.query.staking.validators.keys();
	const fromPrefs = prefs.slice(0, nominateCount).map((k) => k.args[0].toString());
	if (fromPrefs.length === 0) {
		throw new Error(`no validators (session empty, era=${era})`);
	}
	return fromPrefs;
}

function ledger(stash: string, active: bigint) {
	return {
		stash,
		total: active.toString(),
		active: active.toString(),
		unlocking: [],
	};
}

async function main() {
	console.log(`hub ${hubWs}`);
	const provider = new WsProvider(hubWs, 5_000, {}, 60_000);
	const api = await ApiPromise.create({ provider, throwOnConnect: true });
	await api.isReadyOrError;

	if (!api.query.staking) throw new Error("no staking pallet — wrong chain?");

	const keyring = new Keyring({ type: "sr25519" });
	const nom = keyring.addFromUri(NOM_URI);
	const self = keyring.addFromUri(SELF_URI);

	console.log(`nomination stash ${nom.address} (${NOM_URI})`);
	console.log(`self-stake stash  ${self.address} (${SELF_URI})`);

	const targets = await pickValidators(api);
	console.log(`nominate targets (${targets.length}): ${targets.join(", ")}`);

	const era = Number(((await api.query.staking.activeEra()) as any).unwrapOrDefault().index);
	const minNom = BigInt((await api.query.staking.minNominatorBond()).toString());
	if (nomBond < minNom) throw new Error(`nom bond ${nomBond} < MinNominatorBond ${minNom}`);

	// Balances + staking ledger shapes in one shot (no block build / Aura).
	await setStorage(provider, {
		System: {
			Account: [
				[[nom.address], { providers: 1, data: { free: fundAmount.toString() } }],
				[[self.address], { providers: 1, data: { free: fundAmount.toString() } }],
			],
		},
		Staking: {
			Bonded: [
				[[nom.address], nom.address],
				[[self.address], self.address],
			],
			Ledger: [
				[[nom.address], ledger(nom.address, nomBond)],
				[[self.address], ledger(self.address, selfBond)],
			],
			Payee: [
				[[nom.address], "Staked"],
				[[self.address], "Staked"],
			],
			Nominators: [
				[
					[nom.address],
					{ targets, submitted_in: era, suppressed: false },
				],
			],
		},
	});
	console.log(`funded ${fundAmount / DOT} DOT each`);
	console.log(`bonded nom=${nomBond / DOT} DOT self=${selfBond / DOT} DOT + nominators map`);

	const ledgerNom = (await api.query.staking.ledger(nom.address)) as any;
	const ledgerSelf = (await api.query.staking.ledger(self.address)) as any;
	const nominators = (await api.query.staking.nominators(nom.address)) as any;
	if (ledgerNom.isNone) throw new Error("nomination ledger missing after setStorage");
	if (ledgerSelf.isNone) throw new Error("self-stake ledger missing after setStorage");
	if (nominators.isNone) throw new Error("nominators map missing for OrbitNom");

	const freeNom = BigInt(
		((await api.query.system.account(nom.address)) as any).data.free.toString(),
	);
	if (freeNom < fundAmount / 2n) {
		throw new Error(`unexpected free balance ${freeNom} for OrbitNom`);
	}

	const payload = {
		_comment:
			"Orbit lab stashes on Chopsticks Hub (setStorage shapes). Keys: //OrbitNom //OrbitSelf. Not mainnet.",
		nominationStashes: [nom.address],
		selfStakeStashes: [self.address],
		nominateTargets: targets,
		hubWs,
	};
	fs.writeFileSync(outFile, JSON.stringify(payload, null, 2) + "\n");
	console.log(`wrote ${outFile}`);
	console.log(`next: HUB_WS=${hubWs} npm run observe:dry`);

	await api.disconnect();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

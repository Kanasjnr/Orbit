import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blake2b } from "@noble/hashes/blake2b";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import { decodeAddress } from "@polkadot/util-crypto";

const dir = path.dirname(fileURLToPath(import.meta.url));

export const MILLI_UNIT = 1_000_000_000n;
export const DOT = 10n ** 10n;

export type StashConfig = {
  nominationStashes?: string[];
  selfStakeStashes?: string[];
  nominateTargets?: string[];
  operatorAddress?: string;
  operatorUri?: string;
  operatorProxyType?: string;
  hubWs?: string;
};

export type OperatorLabStatus = {
  bonded: boolean;
  validatePrefs: boolean;
  stakingOperatorProxy: boolean;
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
  return fs.existsSync(local)
    ? local
    : path.join(dir, "hub-stashes.example.json");
}

export function loadStashes(
  file = process.env.HUB_STASHES ?? defaultStashFile(),
): StashConfig {
  return JSON.parse(fs.readFileSync(file, "utf8")) as StashConfig;
}

const hubWsHint =
  "Set HUB_WS to the WebSocket URL from the Chopsticks startup log.";

export function resolveHubWs(options?: {
  chopsticks?: boolean;
  preferStashes?: boolean;
  fallback?: string;
}): string {
  const localStashes = path.join(dir, "hub-stashes.json");
  const stashesHubWs = fs.existsSync(localStashes)
    ? loadStashes(localStashes).hubWs
    : undefined;

  if (options?.preferStashes && stashesHubWs) return stashesHubWs;
  if (process.env.HUB_WS) return process.env.HUB_WS;
  if (stashesHubWs) return stashesHubWs;
  if (options?.chopsticks) throw new Error(`HUB_WS is not set. ${hubWsHint}`);
  if (options?.fallback) return options.fallback;
  throw new Error(`HUB_WS is not set. ${hubWsHint}`);
}

export function resolveOrbitWs(): string {
  const ws = process.env.ORBIT_WS;
  if (ws) return ws;
  throw new Error(
    "ORBIT_WS is not set — use the charlie RPC from Zombienet spawn output",
  );
}

export function chopsticksSlotDurationMs(api: ApiPromise): number {
  const babe = Number(api.consts.babe?.expectedBlockTime?.toString() ?? 0);
  if (babe > 0) return babe;
  const asyncBacking = Number(
    api.consts.asyncBacking?.expectedBlockTime?.toString() ?? 0,
  );
  if (asyncBacking > 0) return asyncBacking;
  return 12_000;
}

export async function syncChopsticksAuraTimestamp(
  api: ApiPromise,
  provider: WsProvider,
): Promise<void> {
  const auraSlotDuration = Number(
    api.consts.aura?.slotDuration?.toString() ?? 0,
  );
  if (!auraSlotDuration) return;

  const chopsticksSlot = chopsticksSlotDurationMs(api);
  if (auraSlotDuration === chopsticksSlot) {
    try {
      await provider.send("dev_timeTravel", [Date.now()]);
    } catch {
      /* dev_timeTravel optional */
    }
    return;
  }

  // Chopsticks inherents step at 12s; Aura slots are 24s on Asset Hub.
  const parentTs = BigInt(
    ((await api.query.timestamp.now()) as any).toString(),
  );
  const currentParaSlot = Number(parentTs / BigInt(auraSlotDuration));
  const targetTimestamp =
    BigInt(currentParaSlot + 1) * BigInt(auraSlotDuration) -
    BigInt(chopsticksSlot);

  await provider.send("dev_setStorage", [
    { Timestamp: { Now: targetTimestamp.toString() } },
  ]);
}

export function proxyDeposit(api: ApiPromise): bigint {
  return (
    BigInt(api.consts.proxy.proxyDepositBase.toString()) +
    BigInt(api.consts.proxy.proxyDepositFactor.toString())
  );
}

export function accountsEqual(a: string, b: string): boolean {
  return Buffer.from(decodeAddress(a)).equals(Buffer.from(decodeAddress(b)));
}

export function proxyProxiesStorageValue(
  api: ApiPromise,
  delegate: string,
  proxyType: string,
  deposit = proxyDeposit(api),
): [[{ delegate: string; proxyType: string; delay: number }], string] {
  return [[{ delegate, proxyType, delay: 0 }], deposit.toString()];
}

export async function setLabOperatorProxy(
  provider: WsProvider,
  api: ApiPromise,
  delegator: string,
  delegate: string,
  proxyType: string,
): Promise<void> {
  await provider.send("dev_setStorage", [
    {
      Proxy: {
        Proxies: [
          [[delegator], proxyProxiesStorageValue(api, delegate, proxyType)],
        ],
      },
    },
  ]);
}

export function eventId(
  blockHash: string,
  index: number,
  kind: string,
  amount: bigint,
): Uint8Array {
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
  return new Keyring({ type: "sr25519" }).addFromUri(
    process.env.ORBIT_ORACLE_URI ?? "//Alice",
  );
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
    console.log(
      `[dry] ${kind} ${account} ${amount} era=${era} block=${blockHash.slice(0, 10)}…`,
    );
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

export async function scanBlockRewards(
  api: ApiPromise,
  blockHash: string,
  stashes: StashConfig,
): Promise<HubRewardEvent[]> {
  const header = await api.rpc.chain.getHeader(blockHash);
  const blockNumber = header.number.toNumber();
  const events = (await api.query.system.events.at(blockHash)) as any;
  const nomination = new Set(stashes.nominationStashes ?? []);
  const selfStake = new Set(stashes.selfStakeStashes ?? []);
  const activeIdx = Number(
    ((await api.query.staking.activeEra()) as any).unwrapOrDefault().index,
  );
  const payoutEra = activeIdx > 0 ? activeIdx - 1 : 0;
  const out: HubRewardEvent[] = [];

  for (const [idx, record] of events.entries() as Iterable<[number, any]>) {
    const { event, phase } = record;
    if (event.section !== "staking" || event.method !== "Rewarded") continue;

    const fields = event.data as unknown as Array<{ toString(): string }>;
    const stashStr = fields[0].toString();
    const amountRaw = fields.length >= 3 ? fields[2] : fields[1];
    const amount = BigInt(amountRaw.toString());
    const extrinsicIdx = phase.isApplyExtrinsic
      ? phase.asApplyExtrinsic.toNumber()
      : idx;

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

export async function readVaultTotals(
  orbit: ApiPromise,
): Promise<{ odot: bigint; edot: bigint }> {
  const odot = BigInt((await orbit.query.odot.totalAssets()).toString());
  const edot = BigInt((await orbit.query.edot.totalAssets()).toString());
  return { odot, edot };
}

function proxyTypeLabel(entry: any): string {
  if (entry?.proxyType?.toString) return entry.proxyType.toString();
  if (entry?.proxyType?.toHuman) return String(entry.proxyType.toHuman());
  return String(entry?.proxyType ?? "");
}

function isOperatorProxyType(label: string, expected?: string): boolean {
  const l = label.toLowerCase().replace(/[^a-z]/g, "");
  if (expected) return l === expected.toLowerCase().replace(/[^a-z]/g, "");
  return l === "staking" || l.includes("stakingoperator");
}

export function labOperatorProxyType(api: ApiPromise): string {
  for (const candidate of ["StakingOperator", "Staking"]) {
    try {
      api.registry.createType("ProxyType", candidate);
      return candidate;
    } catch {
      /* next */
    }
  }
  throw new Error("no Staking/StakingOperator ProxyType in runtime metadata");
}

export async function verifyOperatorLab(
  api: ApiPromise,
  stashes: StashConfig,
): Promise<OperatorLabStatus> {
  const self = stashes.selfStakeStashes?.[0];
  const operator = stashes.operatorAddress;
  if (!self) throw new Error("hub-stashes.json missing selfStakeStashes");

  const ledger = (await api.query.staking.ledger(self)) as any;
  const bonded = !ledger.isNone;

  const prefs = (await api.query.staking.validators(self)) as any;
  const validatePrefs = !prefs.isNone;

  let stakingOperatorProxy = false;
  if (operator && (api.query as any).proxy?.proxies) {
    const raw = (await (api.query as any).proxy.proxies(self)) as any;
    const defs = raw?.[0] ?? raw?.unwrapOrDefault?.()?.[0] ?? [];
    const list = Array.isArray(defs) ? defs : [];
    stakingOperatorProxy = list.some(
      (p: any) =>
        accountsEqual(p.delegate?.toString() ?? "", operator) &&
        isOperatorProxyType(proxyTypeLabel(p), stashes.operatorProxyType),
    );
  }

  return { bonded, validatePrefs, stakingOperatorProxy };
}

export async function assertOperatorLab(
  api: ApiPromise,
  stashes: StashConfig,
): Promise<void> {
  const status = await verifyOperatorLab(api, stashes);
  const missing: string[] = [];
  if (!status.bonded) missing.push("bonded ledger");
  if (!status.validatePrefs) missing.push("validate prefs");
  if (stashes.operatorAddress && !status.stakingOperatorProxy)
    missing.push("operator proxy");
  if (missing.length > 0) {
    throw new Error(
      `operator lab incomplete: missing ${missing.join(", ")} — re-run hub:setup`,
    );
  }
  console.log(
    `operator OK bonded=${status.bonded} validate=${status.validatePrefs} proxy=${status.stakingOperatorProxy}`,
  );
}

export async function openHub(hubWs: string): Promise<{
  api: ApiPromise;
  provider: WsProvider;
}> {
  const provider = new WsProvider(hubWs, 5_000, {}, 60_000);
  const api = await ApiPromise.create({ provider, throwOnConnect: true });
  await api.isReadyOrError;
  return { api, provider };
}

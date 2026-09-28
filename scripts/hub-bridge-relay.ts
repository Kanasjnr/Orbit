import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pah } from "@polkadot-api/descriptors";
import type { BlockInfo } from "polkadot-api";
import { createWsClient } from "polkadot-api/ws";
import { WebSocket } from "ws";
import { Keyring } from "@polkadot/keyring";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import {
  connectOrbit,
  eventId,
  hubFeedOracle,
  openLiveHub,
  reportBridgeDeposit,
  reportWithdrawalFulfilled,
  resolveOrbitWs,
} from "./hub.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(dir, "..");

function loadOrbitEnv() {
  const envPath = process.env.ORBIT_ENV ?? path.join(repo, "paseo/orbit.env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (val.startsWith('"') || val.startsWith("'")) {
      const quote = val[0];
      const end = val.indexOf(quote, 1);
      val = end === -1 ? val.slice(1) : val.slice(1, end);
    } else {
      const hashIdx = val.indexOf(" #");
      if (hashIdx !== -1) val = val.slice(0, hashIdx).trim();
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadOrbitEnv();

const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
const hubWs = process.env.HUB_WS ?? "wss://asset-hub-paseo-rpc.n.dwellir.com";
const bridgeAccount = process.env.BRIDGE_RECEIVING_ACCOUNT;
const operatorUri = process.env.PASEO_URI ?? process.env.PASEO_SEED;
const statePath = process.env.RELAY_STATE ?? path.join(dir, "hub-bridge-relay.state.json");

type RelayState = {
  paidWithdrawals: Record<string, { hubTxHash: string; amount: string; hubBeneficiary: string }>;
};

function loadState(): RelayState {
  if (!fs.existsSync(statePath)) return { paidWithdrawals: {} };
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8")) as RelayState;
  } catch {
    return { paidWithdrawals: {} };
  }
}

function saveState(state: RelayState) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

// papi's event.original.phase carries the extrinsic index; without it we fall back to the
// position within the block's event batch, matching hub-observe.ts's own convention.
function extrinsicIndex(ev: { original?: { phase?: { type: string; value?: number } } }, fallback: number) {
  const phase = ev.original?.phase;
  return phase?.type === "ApplyExtrinsic" ? (phase.value ?? fallback) : fallback;
}

// Storage/event field names come from scale-info as declared in the pallet (snake_case for
// custom structs); normalise via toJSON() and accept both casings rather than assume one.
function field(obj: any, name: string): any {
  const camel = name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  return obj?.[name] ?? obj?.[camel];
}

async function main() {
  if (!bridgeAccount) throw new Error("set BRIDGE_RECEIVING_ACCOUNT in paseo/orbit.env");
  if (!operatorUri) {
    throw new Error("set PASEO_URI (operator mnemonic funding withdrawal payouts) — testnet keys only");
  }

  await cryptoWaitReady();
  const operator = new Keyring({ type: "sr25519" }).addFromUri(operatorUri);
  const oracle = hubFeedOracle();
  const state = loadState();

  const orbitWs = resolveOrbitWs();
  const orbit = await connectOrbit(orbitWs);
  if (!orbit.tx.hubBridge) throw new Error(`no hubBridge pallet at ${orbitWs}`);

  console.log(`hub ${hubWs}`);
  console.log(`orbit ${orbitWs}`);
  console.log(`bridge receiving account ${bridgeAccount}`);
  console.log(`operator ${operator.address}`);
  console.log(`dry=${dryRun}`);

  // --- deposit leg: watch Hub for transfers into the bridge account, report them into Orbit ---
  const client = createWsClient(hubWs, { websocketClass: WebSocket as any });
  const hub = client.getTypedApi(pah);

  let era = (await hub.query.Staking.ActiveEra.getValue())?.index ?? 0;
  console.log(`hub activeEra ${era}`);

  const depositStats = { seen: 0, ok: 0, dedup: 0, fail: 0 };

  async function onTransfer(block: BlockInfo, events: any[]) {
    for (const [i, ev] of events.entries()) {
      const { from, to, amount } = ev.payload as { from: string; to: string; amount: bigint };
      if (to !== bridgeAccount || amount === 0n) continue;
      depositStats.seen++;
      const idx = extrinsicIndex(ev, i);
      const id = Array.from(eventId(block.hash, idx, "bridge-deposit", amount));
      console.log(`[deposit] #${block.number}[${idx}] ${from} -> ${to} ${amount}`);
      const res = await reportBridgeDeposit(orbit, oracle, id, era, from, amount, dryRun);
      depositStats[res === "ok" || res === "dedup" ? res : "fail"]++;
    }
  }

  const depositSub = hub.event.Balances.Transfer.watch().subscribe(
    ({ block, events }: { block: BlockInfo; events: any[] }) => {
      if (!events.length) return;
      void hub.query.Staking.ActiveEra.getValue().then((v: { index: number } | undefined) => {
        if (v?.index != null) era = v.index;
      });
      void onTransfer(block, events);
    },
  );

  // --- withdrawal leg: watch Orbit for WithdrawalRequested, pay out on Hub, report fulfilled ---
  const withdrawalStats = { seen: 0, paid: 0, reported: 0, failed: 0 };

  const payoutInFlight = new Set<string>();

  async function payOutOnHub(id: number, amount: bigint, hubBeneficiary: string): Promise<string> {
    const key = String(id);
    const already = state.paidWithdrawals[key];
    if (already) {
      console.log(`[withdrawal ${id}] already paid ${already.hubTxHash}, retrying report only`);
      return already.hubTxHash;
    }
    // Guards against the startup sweep and a live WithdrawalRequested event racing on the same
    // id before either has persisted state — the sweep runs while the subscription is already
    // live, so both paths can observe an unpaid withdrawal at once.
    if (payoutInFlight.has(key)) {
      throw new Error(`payout for withdrawal ${id} already in flight, skipping duplicate`);
    }
    payoutInFlight.add(key);

    if (dryRun) {
      payoutInFlight.delete(key);
      console.log(`[dry] would pay withdrawal ${id}: ${amount} to ${hubBeneficiary} on hub`);
      return "0xdry";
    }

    const liveHub = await openLiveHub(hubWs);
    try {
      const txHash = await new Promise<string>((resolve, reject) => {
        liveHub.tx.balances
          .transferKeepAlive(hubBeneficiary, amount)
          .signAndSend(operator, ({ status, dispatchError, txHash: hash }) => {
            if (dispatchError) {
              if (dispatchError.isModule) {
                const m = liveHub.registry.findMetaError(dispatchError.asModule);
                reject(new Error(`${m.section}.${m.name}`));
              } else {
                reject(new Error(dispatchError.toString()));
              }
              return;
            }
            if (status.isInBlock) resolve(hash.toHex());
          })
          .catch(reject);
      });

      state.paidWithdrawals[key] = { hubTxHash: txHash, amount: amount.toString(), hubBeneficiary };
      saveState(state);
      console.log(`[withdrawal ${id}] paid on hub ${txHash}`);
      return txHash;
    } finally {
      payoutInFlight.delete(key);
      await liveHub.disconnect();
    }
  }

  async function fulfillWithdrawal(id: number, amount: bigint, hubBeneficiary: string) {
    withdrawalStats.seen++;
    try {
      const hubTxHash = await payOutOnHub(id, amount, hubBeneficiary);
      withdrawalStats.paid++;
      const hubEventId = Array.from(eventId(hubTxHash, 0, "withdrawal-fulfilled", amount));
      const res = await reportWithdrawalFulfilled(orbit, oracle, id, hubEventId, dryRun);
      if (res === "ok" || res === "dedup") withdrawalStats.reported++;
      else withdrawalStats.failed++;
    } catch (e: any) {
      withdrawalStats.failed++;
      console.error(`[withdrawal ${id}] failed: ${e?.message ?? e}`);
    }
  }

  // Subscribe before the startup sweep below, so a withdrawal requested while the sweep is
  // still working through existing entries isn't missed — payOutOnHub's in-flight guard and
  // persisted state make the two paths safe to overlap on the same id.
  const unsubEvents = (await orbit.query.system.events((records: any[]) => {
    for (const record of records) {
      const { event } = record;
      if (event.section !== "hubBridge" || event.method !== "WithdrawalRequested") continue;
      const [id, , amount, hubBeneficiary] = event.data as unknown as Array<{ toString(): string }>;
      void fulfillWithdrawal(Number(id.toString()), BigInt(amount.toString()), hubBeneficiary.toString());
    }
  })) as unknown as () => void;

  // Startup sweep: pick up anything already queued before this run started.
  const pending = await orbit.query.hubBridge.pendingWithdrawals.entries();
  for (const [key, value] of pending as unknown as Array<[{ args: unknown[] }, any]>) {
    const id = Number((key.args[0] as { toNumber(): number }).toNumber());
    const w = value.toJSON();
    console.log(`[startup] pending withdrawal ${id}: ${field(w, "amount")} -> ${field(w, "hub_beneficiary")}`);
    await fulfillWithdrawal(id, BigInt(field(w, "amount")), String(field(w, "hub_beneficiary")));
  }

  console.log("watching Hub Balances.Transfer and Orbit hubBridge.WithdrawalRequested");

  const stop = async () => {
    console.log("stop", { deposits: depositStats, withdrawals: withdrawalStats });
    depositSub.unsubscribe();
    unsubEvents();
    client.destroy();
    await orbit.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

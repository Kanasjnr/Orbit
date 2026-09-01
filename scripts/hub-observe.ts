import { pah } from "@polkadot-api/descriptors";
import type { BlockInfo } from "polkadot-api";
import { createWsClient } from "polkadot-api/ws";
import { WebSocket } from "ws";
import {
  connectOrbit,
  defaultStashFile,
  hubFeedOracle,
  loadStashes,
  reportToOrbit,
  resolveHubWs,
  resolveOrbitWs,
} from "./hub.js";

const hubWs = resolveHubWs({
  fallback: "wss://polkadot-asset-hub-rpc.polkadot.io",
});
const dryRun =
  process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
const dumpAll = process.argv.includes("--dump-all");
const timeoutArg = process.argv.find((a) => a.startsWith("--timeout="));
const timeoutSec = timeoutArg ? Number(timeoutArg.split("=")[1]) : 0;
const stashFile = process.env.HUB_STASHES ?? defaultStashFile();

const stashJson = loadStashes(stashFile);
const nomination = new Set(stashJson.nominationStashes ?? []);
const selfStake = new Set(stashJson.selfStakeStashes ?? []);

function extrinsicIndex(
  ev: { original?: { phase?: { type: string; value?: number } } },
  fallback: number,
) {
  const phase = ev.original?.phase;
  return phase?.type === "ApplyExtrinsic"
    ? (phase.value ?? fallback)
    : fallback;
}

async function main() {
  console.log(
    `stashes ${stashFile}  nom=${nomination.size} self=${selfStake.size}  dry=${dryRun}`,
  );
  console.log(`hub ${hubWs}`);

  const client = createWsClient(hubWs, { websocketClass: WebSocket as any });
  const hub = client.getTypedApi(pah);

  let era = (await hub.query.Staking.ActiveEra.getValue())?.index ?? 0;
  console.log(`activeEra ${era}`);

  const orbitWs = dryRun ? null : resolveOrbitWs();
  const orbit = dryRun ? null : await connectOrbit(orbitWs!);
  const oracle = dryRun ? null : hubFeedOracle();
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
    console.log(
      `[${dryRun ? "dry" : "tx"}] #${block.number}[${index}] ${kind} ${account} ${amount} era=${useEra}`,
    );

    if (!orbit || !oracle) return;

    const res = await reportToOrbit(
      orbit,
      oracle,
      kind,
      account,
      amount,
      block.hash,
      index,
      useEra,
      false,
    );
    if (res === "ok") stats.ok++;
  }

  async function onRewarded(block: BlockInfo, events: any[]) {
    for (const [i, ev] of events.entries()) {
      const { stash, amount } = ev.payload;
      const idx = extrinsicIndex(ev, i);
      if (nomination.has(stash))
        await report("nom-reward", stash, amount, block, idx);
      else if (selfStake.has(stash))
        await report("self-reward", stash, amount, block, idx);
      else {
        stats.skip++;
        if (dumpAll)
          console.log(`[skip] #${block.number} reward ${stash} ${amount}`);
      }
    }
  }

  async function onSlashed(block: BlockInfo, events: any[]) {
    for (const [i, ev] of events.entries()) {
      const { staker, amount } = ev.payload;
      if (!selfStake.has(staker)) {
        stats.skip++;
        if (dumpAll)
          console.log(`[skip] #${block.number} slash ${staker} ${amount}`);
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
        if (dumpAll) {
          console.log(
            `[skip] #${block.number} incentive ${validator_stash} ${amount}`,
          );
        }
        continue;
      }
      await report(
        "self-reward",
        validator_stash,
        amount,
        block,
        extrinsicIndex(ev, i),
        paidEra,
      );
    }
  }

  console.log("watching Rewarded / Slashed / ValidatorIncentivePaid");
  if (timeoutSec > 0) console.log(`timeout ${timeoutSec}s`);

  const subs = [
    hub.event.Staking.Rewarded.watch().subscribe(
      ({ block, events }: { block: BlockInfo; events: any[] }) => {
        if (!events.length) return;
        void hub.query.Staking.ActiveEra.getValue().then(
          (v: { index: number } | undefined) => {
            if (v?.index != null) era = v.index;
          },
        );
        void onRewarded(block, events);
      },
    ),
    hub.event.Staking.Slashed.watch().subscribe(
      ({ block, events }: { block: BlockInfo; events: any[] }) => {
        if (!events.length) return;
        void onSlashed(block, events);
      },
    ),
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

  if (timeoutSec > 0) {
    setTimeout(() => void stop(), timeoutSec * 1000);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

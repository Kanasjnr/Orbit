import {
  assertOperatorLab,
  connectOrbit,
  hubFeedOracle,
  loadStashes,
  openHub,
  readVaultTotals,
  reportToOrbit,
  resolveHubWs,
  resolveOrbitWs,
  scanBlockRewards,
} from "./hub.js";
import { runHubPayout } from "./hub-payout.js";

const hubWs = resolveHubWs({ chopsticks: true, preferStashes: true });
const dryRun =
  process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
const skipPayout = process.argv.includes("--skip-payout");
const skipOperatorCheck = process.argv.includes("--skip-operator-check");

async function main() {
  const stashes = loadStashes();
  const orbitWs = dryRun ? null : resolveOrbitWs();
  console.log(`hub ${hubWs}  orbit ${orbitWs ?? "(dry)"}  dry=${dryRun}`);

  let { api: hub } = await openHub(hubWs);
  if (!skipOperatorCheck) {
    await assertOperatorLab(hub, stashes);
  }

  const orbit = dryRun ? null : await connectOrbit(orbitWs!);
  const oracle = dryRun ? null : hubFeedOracle();
  const before = orbit ? await readVaultTotals(orbit) : null;
  if (before) console.log(`before odot=${before.odot} edot=${before.edot}`);

  if (!skipPayout) {
    await hub.disconnect();
    await runHubPayout(hubWs);
    ({ api: hub } = await openHub(hubWs));
  }

  const blockHash = (await hub.rpc.chain.getHeader()).hash.toHex();
  const rewards = await scanBlockRewards(hub, blockHash, stashes);
  if (rewards.length === 0) {
    throw new Error(
      "no lab Rewarded on latest block — run hub:payout or hub:loop without --skip-payout",
    );
  }

  const era = Number(
    ((await hub.query.staking.activeEra()) as any).unwrapOrDefault().index,
  );
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
      throw new Error(
        `odot totalAssets ${after.odot} != ${before.odot + nomReported}`,
      );
    }
    if (selfReported > 0n && after.edot !== before.edot + selfReported) {
      throw new Error(
        `edot totalAssets ${after.edot} != ${before.edot + selfReported}`,
      );
    }
    console.log("hub → orbit OK");
  } else if (dryRun) {
    console.log(
      `[dry] nom=${nomReported} self=${selfReported} (${stats.dry} events)`,
    );
  }

  await hub.disconnect();
  if (orbit) await orbit.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

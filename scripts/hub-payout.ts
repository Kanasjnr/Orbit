import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import {
  DOT,
  loadStashes,
  resolveHubWs,
  scanBlockRewards,
  syncChopsticksAuraTimestamp,
  type StashConfig,
} from "./hub.js";

const rewardDot = BigInt(process.env.HUB_PAYOUT_DOT ?? "10");
const rewardAmount = rewardDot * DOT;

type ValidatorExposure = {
  validator: string;
  own: bigint;
  nominators: Array<[string, bigint]>;
};

async function rpc(
  provider: WsProvider,
  method: string,
  params: unknown[] = [],
) {
  return provider.send(method, params);
}

async function ensureManualBlockBuild(provider: WsProvider) {
  try {
    await rpc(provider, "dev_setBlockBuildMode", ["Manual"]);
  } catch {
    /* config may already set Manual */
  }
}

function labPayoutStorage(
  labEra: number,
  validators: ValidatorExposure[],
  eraPayout: bigint,
  nom: string,
  self: string,
) {
  const individual: Record<string, number> = {};
  const overview: unknown[] = [];
  const paged: unknown[] = [];

  for (const v of validators) {
    individual[v.validator] = 1000;
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
          others: v.nominators.map(([who, value]) => ({
            who,
            value: value.toString(),
          })),
        },
      ]);
    }
  }

  return {
    Staking: {
      DisableMintingGuard: null,
      ClaimedRewards: [[[labEra, self], []]],
      ErasValidatorReward: [[[labEra], eraPayout.toString()]],
      ErasValidatorPrefs: [[[labEra, self], { commission: 0, blocked: false }]],
      ErasRewardPoints: [
        [
          [labEra],
          {
            total: Object.keys(individual).length * 1000,
            individual,
          },
        ],
      ],
      ErasStakersOverview: overview,
      ErasStakersPaged: paged,
      Payee: [
        [[nom], "Stash"],
        [[self], "Stash"],
      ],
    },
  };
}

async function injectPayoutShape(
  api: ApiPromise,
  provider: WsProvider,
  stashes: StashConfig,
  nomBond: bigint,
  selfBond: bigint,
) {
  const activeIdx = Number(
    ((await api.query.staking.activeEra()) as any).unwrapOrDefault().index,
  );
  const labEra = activeIdx > 0 ? activeIdx - 1 : 0;

  const nom = stashes.nominationStashes?.[0];
  const self = stashes.selfStakeStashes?.[0];
  if (!nom || !self) {
    throw new Error("hub-stashes.json missing stashes — run hub:setup");
  }

  const validators: ValidatorExposure[] = [
    { validator: self, own: selfBond, nominators: [[nom, nomBond]] },
  ];
  const eraPayout = rewardAmount * BigInt(validators.length);
  await rpc(provider, "dev_setStorage", [
    labPayoutStorage(labEra, validators, eraPayout, nom, self),
  ]);
  return { era: labEra, payoutValidator: self, nom, self };
}

async function buildPayoutBlock(
  api: ApiPromise,
  provider: WsProvider,
  era: number,
  validator: string,
) {
  await syncChopsticksAuraTimestamp(api, provider);
  await ensureManualBlockBuild(provider);

  const before = (await api.rpc.chain.getHeader()).number.toNumber();
  const payer = new Keyring({
    type: "sr25519",
    ss58Format: api.registry.chainSS58,
  }).addFromUri(process.env.HUB_PAYER_URI ?? "//Alice");

  await rpc(provider, "dev_setStorage", [
    {
      System: {
        Account: [
          [
            [payer.address],
            { providers: 1, data: { free: (1000n * DOT).toString() } },
          ],
        ],
      },
    },
  ]);

  const signed = await api.tx.staking
    .payoutStakersByPage(validator, era, 0)
    .signAsync(payer);

  const blockHash = (await rpc(provider, "dev_newBlock", [
    { count: 1, transactions: [signed.toHex()] },
  ])) as string;

  const after = (await api.rpc.chain.getHeader()).number.toNumber();
  if (after <= before) {
    throw new Error(
      "dev_newBlock did not advance — restart Chopsticks and re-run hub:setup hub:payout",
    );
  }

  return blockHash;
}

async function assertPayoutExtrinsic(api: ApiPromise, blockHash: string) {
  const block = await api.rpc.chain.getBlock(blockHash);
  const payoutIdx = block.block.extrinsics.findIndex(
    (ext) =>
      ext.method.section === "staking" &&
      ext.method.method === "payoutStakersByPage",
  );
  if (payoutIdx < 0) {
    throw new Error("payout block missing staking.payoutStakersByPage");
  }

  const events = (await api.query.system.events.at(blockHash)) as any;
  let payoutStarted = false;
  for (const { event, phase } of events) {
    if (event.section === "staking" && event.method === "PayoutStarted") {
      payoutStarted = true;
    }
    if (event.section !== "system" || event.method !== "ExtrinsicFailed") {
      continue;
    }
    if (
      !phase.isApplyExtrinsic ||
      phase.asApplyExtrinsic.toNumber() !== payoutIdx
    ) {
      continue;
    }
    const meta = api.registry.findMetaError(event.data[0].asModule);
    throw new Error(
      `staking.payoutStakersByPage failed: ${meta.section}.${meta.name}`,
    );
  }
  if (!payoutStarted) {
    throw new Error("payout extrinsic did not emit PayoutStarted");
  }
}

export async function runHubPayout(hubWs = resolveHubWs({ chopsticks: true, preferStashes: true })) {
  console.log(`hub ${hubWs}`);
  const stashes = loadStashes();
  if ((stashes.nominationStashes?.length ?? 0) === 0) {
    throw new Error("empty nominationStashes — run hub:setup first");
  }

  const provider = new WsProvider(hubWs, 5_000, {}, 60_000);
  const api = await ApiPromise.create({ provider, throwOnConnect: true });
  await api.isReadyOrError;

  const nomBond = BigInt(process.env.HUB_NOM_BOND_DOT ?? "500") * DOT;
  const selfBond = BigInt(process.env.HUB_SELF_BOND_DOT ?? "12000") * DOT;

  const { era, payoutValidator, nom } = await injectPayoutShape(
    api,
    provider,
    stashes,
    nomBond,
    selfBond,
  );
  console.log(`era ${era} nom ${nom} → validator ${payoutValidator}`);
  console.log(`reward ${rewardDot} DOT (${rewardAmount} planck) per path`);

  const blockHash = await buildPayoutBlock(api, provider, era, payoutValidator);
  console.log(`built block ${blockHash}`);
  await assertPayoutExtrinsic(api, blockHash);

  const rewards = await scanBlockRewards(api, blockHash, stashes);
  if (rewards.length === 0) {
    throw new Error("no Staking.Rewarded for lab stashes in payout block");
  }
  for (const r of rewards) {
    console.log(
      `Rewarded ${r.kind} stash=${r.stash} amount=${r.amount} block=#${r.blockNumber}[${r.index}]`,
    );
  }

  await api.disconnect();
  return { blockHash, rewards };
}

async function main() {
  await runHubPayout();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

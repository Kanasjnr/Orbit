import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import {
  assertOperatorLab,
  DOT,
  labOperatorProxyType,
  proxyDeposit,
  resolveHubWs,
  setLabOperatorProxy,
  type StashConfig,
} from "./hub.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const hubWs = resolveHubWs({ chopsticks: true });
const outFile = process.env.HUB_STASHES ?? path.join(dir, "hub-stashes.json");

const fundAmount = BigInt(process.env.HUB_FUND_DOT ?? "100000") * DOT;
const nomBond = BigInt(process.env.HUB_NOM_BOND_DOT ?? "500") * DOT;
const selfBond = BigInt(process.env.HUB_SELF_BOND_DOT ?? "12000") * DOT;
const opFund = BigInt(process.env.HUB_OP_FUND_DOT ?? "100") * DOT;

const NOM_URI = process.env.HUB_NOM_URI ?? "//OrbitNom";
const SELF_URI = process.env.HUB_SELF_URI ?? "//OrbitSelf";
const OP_URI = process.env.HUB_OP_URI ?? "//OrbitOp";

async function setStorage(
  provider: WsProvider,
  storage: Record<string, unknown>,
) {
  await provider.send("dev_setStorage", [storage]);
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
  if (!(api.query as any).proxy?.proxies) {
    throw new Error("no proxy pallet — wrong Asset Hub fork?");
  }

  const keyring = new Keyring({
    type: "sr25519",
    ss58Format: api.registry.chainSS58,
  });
  const nom = keyring.addFromUri(NOM_URI);
  const self = keyring.addFromUri(SELF_URI);
  const op = keyring.addFromUri(OP_URI);
  const targets = [self.address];

  console.log(`nom ${nom.address}  self ${self.address}  op ${op.address}`);
  console.log(`nominate ${targets.join(", ")}`);

  const era = Number(
    ((await api.query.staking.activeEra()) as any).unwrapOrDefault().index,
  );
  const minNom = BigInt(
    (await api.query.staking.minNominatorBond()).toString(),
  );
  if (nomBond < minNom)
    throw new Error(`nom bond ${nomBond} < MinNominatorBond ${minNom}`);

  const operatorProxyType = labOperatorProxyType(api);
  console.log(`proxy type ${operatorProxyType} deposit ${proxyDeposit(api)}`);

  await setStorage(provider, {
    System: {
      Account: [
        [
          [nom.address],
          { providers: 1, data: { free: (fundAmount - nomBond).toString() } },
        ],
        [
          [self.address],
          { providers: 1, data: { free: (fundAmount - selfBond).toString() } },
        ],
        [[op.address], { providers: 1, data: { free: opFund.toString() } }],
      ],
    },
    Staking: {
      DisableMintingGuard: null,
      Bonded: [
        [[nom.address], nom.address],
        [[self.address], self.address],
      ],
      Ledger: [
        [[nom.address], ledger(nom.address, nomBond)],
        [[self.address], ledger(self.address, selfBond)],
      ],
      Payee: [
        [[nom.address], "Stash"],
        [[self.address], "Stash"],
      ],
      Nominators: [
        [[nom.address], { targets, submitted_in: era, suppressed: false }],
      ],
      Validators: [[[self.address], { commission: 0, blocked: false }]],
    },
  });

  await setLabOperatorProxy(
    provider,
    api,
    self.address,
    op.address,
    operatorProxyType,
  );

  const payload: StashConfig = {
    nominationStashes: [nom.address],
    selfStakeStashes: [self.address],
    nominateTargets: targets,
    operatorAddress: op.address,
    operatorUri: OP_URI,
    operatorProxyType,
    hubWs,
  };
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2) + "\n");
  console.log(`wrote ${outFile}`);

  await assertOperatorLab(api, payload);
  await api.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

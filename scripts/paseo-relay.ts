import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import { cryptoWaitReady } from "@polkadot/util-crypto";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(dir, "..");

function loadOrbitEnv() {
  const envPath =
    process.env.ORBIT_ENV ?? path.join(repo, "paseo/orbit.env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadOrbitEnv();

const paseoWs =
  process.env.PASEO_WS ?? "wss://paseo-rpc.n.dwellir.com";
const uri = process.env.PASEO_URI ?? process.env.PASEO_SEED;
const cmd = process.argv[2] ?? "reserve";

function readBytes(file: string): `0x${string}` {
  const raw = fs.readFileSync(file);
  const text = raw.toString("utf8").trim();
  if (text.startsWith("0x")) return text as `0x${string}`;
  return `0x${raw.toString("hex")}` as `0x${string}`;
}

async function signExtrinsic(
  api: ApiPromise,
  call: any,
  pair: ReturnType<Keyring["addFromUri"]>,
) {
  return new Promise<{ hash: string; blockHash: string; events: any[] }>(
    (resolve, reject) => {
      call
        .signAndSend(pair, ({ status, dispatchError, txHash, events }: any) => {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const m = api.registry.findMetaError(dispatchError.asModule);
              reject(new Error(`${m.section}.${m.name}`));
            } else {
              reject(new Error(dispatchError.toString()));
            }
            return;
          }
          if (status.isInBlock) {
            resolve({
              hash: txHash.toHex(),
              blockHash: status.asInBlock.toHex(),
              events: events ? [...events] : [],
            });
          }
        })
        .catch(reject);
    },
  );
}

function findReservedParaId(events: any[]): number | null {
  for (const { event } of events) {
    if (event.section === "registrar" && event.method === "Reserved") {
      return Number(event.data[0].toString());
    }
  }
  return null;
}

async function openPaseo() {
  const api = await ApiPromise.create({
    provider: new WsProvider(paseoWs, 2_500, {}, 30_000),
    throwOnConnect: true,
  });
  await api.isReadyOrError;
  return api;
}

async function reserve(pair: ReturnType<Keyring["addFromUri"]>) {
  const api = await openPaseo();
  console.log(`paseo ${paseoWs}`);
  console.log(`signer ${pair.address}`);

  const { hash, blockHash, events } = await signExtrinsic(
    api,
    api.tx.registrar.reserve(),
    pair,
  );
  console.log(`tx ${hash} in ${blockHash}`);

  const paraId = findReservedParaId(events);
  if (paraId == null) {
    console.log("no registrar.Reserved in block — check explorer");
  } else {
    console.log(`PARA_ID=${paraId}`);
    console.log(`export PARA_ID=${paraId}`);
  }

  await api.disconnect();
}

async function register(pair: ReturnType<Keyring["addFromUri"]>) {
  const paraId = Number(process.env.PARA_ID);
  if (!Number.isFinite(paraId)) {
    throw new Error("set PARA_ID from reserve output");
  }

  const wasmPath =
    process.env.PASEO_WASM ??
    path.join(repo, "paseo/generated/orbit.wasm");
  const headPath =
    process.env.PASEO_HEAD ??
    path.join(repo, "paseo/generated/orbit-head");
  if (!fs.existsSync(wasmPath) || !fs.existsSync(headPath)) {
    throw new Error(
      `missing ${wasmPath} or ${headPath} — run paseo/export-genesis.sh`,
    );
  }

  const api = await openPaseo();
  console.log(`paseo ${paseoWs}  para ${paraId}`);
  console.log(`signer ${pair.address}`);

  const { hash, blockHash } = await signExtrinsic(
    api,
    api.tx.registrar.register(paraId, readBytes(headPath), readBytes(wasmPath)),
    pair,
  );
  console.log(`registered tx ${hash} in ${blockHash}`);
  console.log("wait for onboarding, then obtain coretime on Paseo");

  await api.disconnect();
}

async function balance(pair: ReturnType<Keyring["addFromUri"]>) {
  const api = await openPaseo();
  const acct = await api.query.system.account(pair.address);
  const free = (acct as any).data.free.toString();
  console.log(`${pair.address} free=${free}`);
  await api.disconnect();
}

async function coretime(pair: ReturnType<Keyring["addFromUri"]>) {
  const paraId = Number(process.env.PARA_ID);
  if (!Number.isFinite(paraId)) {
    throw new Error("set PARA_ID in orbit.env");
  }

  const maxAmount = BigInt(
    process.env.PASEO_CORETIME_MAX ?? "1000000000000",
  );
  const keepAlive = process.env.PASEO_CORETIME_ALLOW_DEATH !== "1";

  const api = await openPaseo();
  console.log(`paseo ${paseoWs}  para ${paraId}`);
  console.log(`signer ${pair.address}`);
  console.log(`maxAmount ${maxAmount} keepAlive ${keepAlive}`);

  const call = keepAlive
    ? api.tx.onDemand.placeOrderKeepAlive(maxAmount, paraId)
    : api.tx.onDemand.placeOrderAllowDeath(maxAmount, paraId);

  const { hash, blockHash } = await signExtrinsic(api, call, pair);
  console.log(`coretime tx ${hash} in ${blockHash}`);
  console.log("one order ≈ one block — repeat or buy bulk coretime for steady production");

  await api.disconnect();
}

async function main() {
  if (!uri) {
    throw new Error(
      "set PASEO_URI (mnemonic or //Alice) — testnet keys only",
    );
  }

  await cryptoWaitReady();
  const pair = new Keyring({ type: "sr25519" }).addFromUri(uri);

  if (cmd === "reserve") await reserve(pair);
  else if (cmd === "register") await register(pair);
  else if (cmd === "balance") await balance(pair);
  else if (cmd === "coretime") await coretime(pair);
  else {
    throw new Error(
      "usage: tsx paseo-relay.ts reserve|register|balance|coretime",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import { blake2AsHex, cryptoWaitReady } from "@polkadot/util-crypto";

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

const collatorRpc = process.env.COLLATOR_RPC ?? "8845";
const collatorWs = process.env.ORBIT_WS ?? `ws://127.0.0.1:${collatorRpc}`;
const uri = process.env.PASEO_URI ?? process.env.PASEO_SEED;
const wasmPath =
  process.env.ORBIT_WASM ??
  path.join(repo, "target/release/wbuild/parachain-template-runtime/parachain_template_runtime.compact.compressed.wasm");

async function signExtrinsic(api: ApiPromise, call: any, pair: ReturnType<Keyring["addFromUri"]>) {
  return new Promise<{ hash: string; blockHash: string }>((resolve, reject) => {
    call
      .signAndSend(pair, ({ status, dispatchError, txHash }: any) => {
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
          resolve({ hash: txHash.toHex(), blockHash: status.asInBlock.toHex() });
        }
      })
      .catch(reject);
  });
}

async function main() {
  if (!uri) throw new Error("set PASEO_URI (sudo/operator mnemonic) — testnet keys only");
  if (!fs.existsSync(wasmPath)) {
    throw new Error(`missing ${wasmPath} — run: cargo build -p parachain-template-runtime --release`);
  }

  await cryptoWaitReady();
  const pair = new Keyring({ type: "sr25519" }).addFromUri(uri);

  const wasm = fs.readFileSync(wasmPath);
  const codeHash = blake2AsHex(wasm, 256);
  console.log(`wasm ${wasmPath} (${wasm.length} bytes)`);
  console.log(`code hash ${codeHash}`);

  const api = await ApiPromise.create({ provider: new WsProvider(collatorWs), throwOnConnect: true });
  await api.isReadyOrError;
  console.log(`orbit ${collatorWs}`);
  console.log(`signer ${pair.address}`);

  const before = await api.rpc.state.getRuntimeVersion();
  console.log(`current specVersion ${before.specVersion.toString()}`);

  console.log("authorizing upgrade (sudo, root-only call)...");
  const auth = await signExtrinsic(
    api,
    api.tx.sudo.sudo(api.tx.parachainSystem.authorizeUpgrade(codeHash, true)),
    pair,
  );
  console.log(`authorized tx ${auth.hash} in ${auth.blockHash}`);

  console.log("enacting upgrade (plain signed call — the code hash check is the guard)...");
  const enact = await signExtrinsic(
    api,
    api.tx.parachainSystem.enactAuthorizedUpgrade(`0x${wasm.toString("hex")}`),
    pair,
  );
  console.log(`enacted tx ${enact.hash} in ${enact.blockHash}`);
  console.log("waiting for the relay chain to validate the new code (polling specVersion, up to 5 min)...");

  const beforeVersion = before.specVersion.toString();
  let applied = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    const now = await api.rpc.state.getRuntimeVersion();
    if (now.specVersion.toString() !== beforeVersion) {
      console.log(`runtime upgraded: specVersion ${beforeVersion} -> ${now.specVersion.toString()}`);
      applied = true;
      break;
    }
  }
  if (!applied) {
    console.log("still on old specVersion after 5 min — check collator logs for validation errors");
  }

  await api.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

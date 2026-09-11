import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { BN } from "@polkadot/util";

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadOrbitEnv();

const collatorRpc = process.env.COLLATOR_RPC ?? "8845";
const collatorWs = process.env.ORBIT_WS ?? `ws://127.0.0.1:${collatorRpc}`;
const uri = process.env.PASEO_URI ?? process.env.PASEO_SEED;
const DECIMALS = 12; // matches runtime UNIT = 10^12, not the chain spec's cosmetic tokenDecimals

function toPlanck(amount: string): BN {
  const [whole, frac = ""] = amount.trim().split(".");
  const padded = frac.slice(0, DECIMALS).padEnd(DECIMALS, "0");
  const base = new BN(10).pow(new BN(DECIMALS));
  return new BN(whole || "0").mul(base).add(new BN(padded || "0"));
}

async function main() {
  const [target, amountArg] = process.argv.slice(2);
  if (!target || !amountArg) {
    throw new Error("usage: tsx paseo-fund.ts <address> <amount-in-PAS>");
  }
  if (!uri) throw new Error("set PASEO_URI (operator mnemonic) — testnet keys only");

  await cryptoWaitReady();
  const pair = new Keyring({ type: "sr25519" }).addFromUri(uri);
  const amount = toPlanck(amountArg);

  const api = await ApiPromise.create({ provider: new WsProvider(collatorWs), throwOnConnect: true });
  await api.isReadyOrError;
  console.log(`orbit ${collatorWs}`);
  console.log(`from ${pair.address}`);
  console.log(`to   ${target}`);
  console.log(`amount ${amountArg} (${amount.toString()} planck)`);

  await new Promise<void>((resolve, reject) => {
    api.tx.balances
      .transferKeepAlive(target, amount)
      .signAndSend(pair, ({ status, dispatchError, txHash }) => {
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
          console.log(`tx ${txHash.toHex()} in ${status.asInBlock.toHex()}`);
          resolve();
        }
      })
      .catch(reject);
  });

  await api.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

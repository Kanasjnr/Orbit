// Throwaway Zombienet-only funding script. Alice ("//Alice", a public well-known dev
// seed baked into every Substrate dev chain, not a real secret) sends local test
// balance to a target address so a real wallet has something to deposit with.
// Not for live use; delete once Zombienet testing is done.
//
// Usage: tsx zombienet-fund.ts <address> [amount-in-UNIT] [ws-endpoint]

import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { BN } from "@polkadot/util";

const DECIMALS = 12;

function toPlanck(amount: string): BN {
  const [whole, frac = ""] = amount.trim().split(".");
  const padded = frac.slice(0, DECIMALS).padEnd(DECIMALS, "0");
  const base = new BN(10).pow(new BN(DECIMALS));
  return new BN(whole || "0").mul(base).add(new BN(padded || "0"));
}

async function main() {
  const [target, amountArg = "1000", wsArg] = process.argv.slice(2);
  if (!target) throw new Error("usage: tsx zombienet-fund.ts <address> [amount-in-UNIT] [ws-endpoint]");

  const ws = wsArg ?? "ws://127.0.0.1:9988";
  await cryptoWaitReady();
  const alice = new Keyring({ type: "sr25519" }).addFromUri("//Alice");
  const amount = toPlanck(amountArg);

  const api = await ApiPromise.create({ provider: new WsProvider(ws), throwOnConnect: true });
  await api.isReadyOrError;
  console.log(`zombienet ${ws}`);
  console.log(`from ${alice.address} (Alice, dev)`);
  console.log(`to   ${target}`);
  console.log(`amount ${amountArg} (${amount.toString()} planck)`);

  await new Promise<void>((resolve, reject) => {
    api.tx.balances
      .transferKeepAlive(target, amount)
      .signAndSend(alice, ({ status, dispatchError, txHash }) => {
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

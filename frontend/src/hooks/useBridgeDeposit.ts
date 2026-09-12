import type { ApiPromise } from "@polkadot/api";
import type { Signer } from "@polkadot/api/types";
import { BN } from "@polkadot/util";
import { useCallback, useRef, useState } from "react";
import { bridgeReceivingAccount } from "@/lib/hubChain";
import { formatDispatchError } from "@/lib/format";
import type { VaultKind } from "./useVault";

export type BridgeDepositStep =
  | "idle"
  | "awaiting-hub-signature"
  | "awaiting-bridge-credit"
  | "awaiting-orbit-deposit"
  | "done";

const CREDIT_TIMEOUT_MS = 5 * 60_000;
const POLL_MS = 5_000;

interface Params {
  hubApi: ApiPromise | null;
  orbitApi: ApiPromise | null;
  account: string | null;
  signer: Signer | null;
  vaultKind: VaultKind;
}

function signAndWait(extrinsic: any, account: string, signer: Signer, api: ApiPromise) {
  return new Promise<void>((resolve, reject) => {
    extrinsic
      .signAndSend(account, { signer }, (result: any) => {
        if (result.dispatchError) {
          reject(new Error(formatDispatchError(api, result.dispatchError)));
          return;
        }
        if (result.status.isInBlock || result.status.isFinalized) {
          resolve();
        }
      })
      .catch(reject);
  });
}

async function readFreeBalance(api: ApiPromise, account: string): Promise<BN> {
  const info = (await api.query.system.account(account)) as unknown as {
    data: { free: { toString(): string } };
  };
  return new BN(info.data.free.toString());
}

export function useBridgeDeposit({ hubApi, orbitApi, account, signer, vaultKind }: Params) {
  const [step, setStep] = useState<BridgeDepositStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
  }, []);

  const start = useCallback(
    async (amount: BN) => {
      if (!hubApi || !orbitApi || !account || !signer) {
        setError("Wallet or chain not connected");
        return;
      }
      cancelledRef.current = false;
      setError(null);

      try {
        setStep("awaiting-hub-signature");
        const transfer = hubApi.tx.balances.transferKeepAlive(bridgeReceivingAccount(), amount);
        await signAndWait(transfer, account, signer, hubApi);
        if (cancelledRef.current) return;

        setStep("awaiting-bridge-credit");
        const before = await readFreeBalance(orbitApi, account);
        const target = before.add(amount);
        const deadline = Date.now() + CREDIT_TIMEOUT_MS;
        let credited = false;
        while (!cancelledRef.current && Date.now() < deadline) {
          const current = await readFreeBalance(orbitApi, account);
          if (current.gte(target)) {
            credited = true;
            break;
          }
          await new Promise((r) => setTimeout(r, POLL_MS));
        }
        if (cancelledRef.current) return;
        if (!credited) {
          throw new Error(
            "Timed out waiting for the bridge to credit your deposit. The relayer may not be running.",
          );
        }

        setStep("awaiting-orbit-deposit");
        const deposit = orbitApi.tx[vaultKind].deposit(amount);
        await signAndWait(deposit, account, signer, orbitApi);
        if (cancelledRef.current) return;

        setStep("done");
      } catch (err) {
        if (!cancelledRef.current) setError((err as Error).message);
      }
    },
    [hubApi, orbitApi, account, signer, vaultKind],
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setStep("idle");
  }, []);

  return { step, error, start, cancel, reset };
}

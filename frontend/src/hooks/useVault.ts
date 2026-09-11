import type { ApiPromise } from "@polkadot/api";
import type { Signer, SubmittableExtrinsic } from "@polkadot/api/types";
import { BN, BN_ZERO } from "@polkadot/util";
import { useCallback, useEffect, useState } from "react";
import { formatDispatchError } from "../lib/format";

export type VaultKind = "odot" | "edot";

export interface RedeemRequest {
  id: number;
  shares: BN;
  unlockAt: BN;
  claimable: boolean;
}

interface VaultState {
  shares: BN;
  totalAssets: BN;
  totalShares: BN;
  redeemRequests: RedeemRequest[];
  busy: boolean;
  error: string | null;
}

const initialState: VaultState = {
  shares: BN_ZERO,
  totalAssets: BN_ZERO,
  totalShares: BN_ZERO,
  redeemRequests: [],
  busy: false,
  error: null,
};

// V/S rate, applied client-side: the pallet only exposes TotalAssets /
// TotalShares / Shares storage, no query-time conversion call.
export function assetsFor(shares: BN, totalAssets: BN, totalShares: BN): BN {
  if (totalShares.isZero()) return BN_ZERO;
  return shares.mul(totalAssets).div(totalShares);
}

function toBN(codec: { toString(): string }): BN {
  return new BN(codec.toString());
}

export function useVault(api: ApiPromise | null, kind: VaultKind, account: string | null) {
  const [state, setState] = useState<VaultState>(initialState);
  const pallet = api?.query[kind];
  const tx = api?.tx[kind];

  const refreshRedeemRequests = useCallback(async () => {
    if (!api || !pallet || !account) return;
    const [entries, bestNumber] = await Promise.all([
      pallet.redeemRequests.entries(account),
      api.query.system.number(),
    ]);
    const current = toBN(bestNumber);
    const requests: RedeemRequest[] = entries.map(([key, value]) => {
      const id = (key.args[1] as unknown as { toNumber(): number }).toNumber();
      const struct = (
        value as unknown as { unwrap(): { get(name: string): { toString(): string } | undefined } }
      ).unwrap();
      const shares = toBN(struct.get("shares") ?? struct.get("Shares")!);
      const unlockAt = toBN(struct.get("unlock_at") ?? struct.get("unlockAt")!);
      return { id, shares, unlockAt, claimable: current.gte(unlockAt) };
    });
    requests.sort((a, b) => a.id - b.id);
    setState((s) => ({ ...s, redeemRequests: requests }));
  }, [api, pallet, account]);

  useEffect(() => {
    if (!api || !pallet || !account) {
      setState(initialState);
      return;
    }
    let cancelled = false;
    const unsubPromise = api.queryMulti(
      [
        [pallet.shares, account],
        pallet.totalAssets,
        pallet.totalShares,
      ],
      ([shares, totalAssets, totalShares]) => {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          shares: toBN(shares),
          totalAssets: toBN(totalAssets),
          totalShares: toBN(totalShares),
        }));
      },
    );
    refreshRedeemRequests();
    return () => {
      cancelled = true;
      unsubPromise.then((unsub) => unsub());
    };
  }, [api, pallet, account, refreshRedeemRequests]);

  const submit = useCallback(
    async (extrinsic: SubmittableExtrinsic<"promise">, signer: Signer) => {
      if (!api || !account) return;
      setState((s) => ({ ...s, busy: true, error: null }));
      try {
        await new Promise<void>((resolve, reject) => {
          extrinsic
            .signAndSend(account, { signer }, (result) => {
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
        await refreshRedeemRequests();
      } catch (err) {
        setState((s) => ({ ...s, error: (err as Error).message }));
      } finally {
        setState((s) => ({ ...s, busy: false }));
      }
    },
    [api, account, refreshRedeemRequests],
  );

  const deposit = useCallback(
    (amount: BN, signer: Signer) => (tx ? submit(tx.deposit(amount), signer) : Promise.resolve()),
    [tx, submit],
  );
  const redeemInstant = useCallback(
    (shares: BN, signer: Signer) => (tx?.redeem ? submit(tx.redeem(shares), signer) : Promise.resolve()),
    [tx, submit],
  );
  const requestRedeem = useCallback(
    (shares: BN, signer: Signer) => (tx ? submit(tx.requestRedeem(shares), signer) : Promise.resolve()),
    [tx, submit],
  );
  const claimRedeem = useCallback(
    (id: number, signer: Signer) => (tx ? submit(tx.claimRedeem(id), signer) : Promise.resolve()),
    [tx, submit],
  );

  return {
    ...state,
    deposit,
    redeemInstant,
    requestRedeem,
    claimRedeem,
    supportsInstantRedeem: kind === "odot",
  };
}

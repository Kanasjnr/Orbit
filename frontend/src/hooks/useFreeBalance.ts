import type { ApiPromise } from "@polkadot/api";
import { BN, BN_ZERO } from "@polkadot/util";
import { useEffect, useState } from "react";

interface AccountInfo {
  data: { free: { toString(): string } };
}

export function useFreeBalance(api: ApiPromise | null, account: string | null) {
  const [free, setFree] = useState<BN>(BN_ZERO);

  useEffect(() => {
    if (!api || !account) {
      setFree(BN_ZERO);
      return;
    }
    let cancelled = false;
    let unsub: (() => void) | undefined;

    (
      api.query.system.account(account, (info: unknown) => {
        if (!cancelled) setFree(new BN((info as AccountInfo).data.free.toString()));
      }) as unknown as Promise<() => void>
    ).then((fn) => {
      if (cancelled) fn();
      else unsub = fn;
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [api, account]);

  return free;
}

import type { ApiPromise } from "@polkadot/api";
import { useEffect, useState } from "react";

export function useBlockNumber(api: ApiPromise | null) {
  const [blockNumber, setBlockNumber] = useState<number | null>(null);

  useEffect(() => {
    if (!api) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;

    api.rpc.chain.subscribeNewHeads((header) => {
      if (!cancelled) setBlockNumber(header.number.toNumber());
    }).then((fn) => {
      if (cancelled) fn();
      else unsub = fn;
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [api]);

  return blockNumber;
}

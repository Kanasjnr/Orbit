import type { ApiPromise } from "@polkadot/api";
import { BN, BN_ZERO } from "@polkadot/util";
import { useEffect, useState } from "react";

const POLL_MS = 12_000;

interface MixMetrics {
  eDotBacking: BN;
  oDotBacking: BN;
  phiPercent: number;
  openableSlots: number;
}

const empty: MixMetrics = { eDotBacking: BN_ZERO, oDotBacking: BN_ZERO, phiPercent: 0, openableSlots: 0 };

export function useMixMetrics(api: ApiPromise | null) {
  const [metrics, setMetrics] = useState<MixMetrics>(empty);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;

    const fetchOnce = () => {
      api.call.orbitMixApi
        .mixMetrics()
        .then((raw) => {
          if (cancelled) return;
          const tuple = raw as unknown as [
            { toString(): string },
            { toString(): string },
            { toNumber(): number },
            { toNumber(): number },
          ];
          setMetrics({
            eDotBacking: new BN(tuple[0].toString()),
            oDotBacking: new BN(tuple[1].toString()),
            phiPercent: tuple[2].toNumber() / 10_000,
            openableSlots: tuple[3].toNumber(),
          });
          setError(null);
        })
        .catch((err) => !cancelled && setError((err as Error).message));
    };

    fetchOnce();
    const interval = setInterval(fetchOnce, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [api]);

  return { metrics, error };
}

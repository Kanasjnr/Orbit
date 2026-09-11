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
      // Raw state_call rather than api.call.orbitMixApi.mixMetrics(): that
      // path depends on ApiPromise's `runtime` option registering the exact
      // metadata shape, which isn't guaranteed across polkadot-api versions.
      api.rpc.state
        .call("OrbitMixApi_mix_metrics", "0x")
        .then((raw) => {
          if (cancelled) return;
          const [eDot, oDot, phi, slots] = api.registry.createType(
            "(u128, u128, Permill, u32)",
            raw,
          ) as unknown as [
            { toString(): string },
            { toString(): string },
            { toNumber(): number },
            { toNumber(): number },
          ];
          setMetrics({
            eDotBacking: new BN(eDot.toString()),
            oDotBacking: new BN(oDot.toString()),
            phiPercent: phi.toNumber() / 10_000,
            openableSlots: slots.toNumber(),
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

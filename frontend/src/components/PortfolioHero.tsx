import type { ApiPromise } from "@polkadot/api";
import { BN_ZERO } from "@polkadot/util";
import { useWallet } from "@/context/WalletProvider";
import { assetsFor, useVault } from "@/hooks/useVault";
import { fromPlanck } from "@/lib/format";
import { tokenSymbol } from "@/lib/chain";
import { Card, CardContent } from "@/components/ui/card";

const SYMBOL = tokenSymbol();

export function PortfolioHero({ api }: { api: ApiPromise | null }) {
  const { selected: account } = useWallet();
  const odot = useVault(api, "odot", account);
  const edot = useVault(api, "edot", account);

  if (!account) return null;

  const odotValue = assetsFor(odot.shares, odot.totalAssets, odot.totalShares);
  const edotValue = assetsFor(edot.shares, edot.totalAssets, edot.totalShares);
  const total = odotValue.add(edotValue);

  if (total.eq(BN_ZERO) && odot.shares.eq(BN_ZERO) && edot.shares.eq(BN_ZERO)) return null;

  return (
    <Card className="overflow-hidden border-none bg-gradient-to-br from-[#0d0e26] via-[#161831] to-[#1a1030] text-white">
      <CardContent className="py-2">
        <p className="text-sm text-white/60">Your position</p>
        <p className="mt-1 text-4xl font-bold tabular-nums sm:text-5xl">
          {fromPlanck(total)} <span className="text-2xl font-semibold text-white/50 sm:text-3xl">{SYMBOL}</span>
        </p>
        <div className="mt-5 flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-gradient-to-br from-[#00D2FF] to-[#22c1dc]" />
            <span className="text-sm text-white/60">oDOT</span>
            <span className="text-sm font-semibold tabular-nums">{fromPlanck(odotValue)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#a855f7]" />
            <span className="text-sm text-white/60">eDOT</span>
            <span className="text-sm font-semibold tabular-nums">{fromPlanck(edotValue)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

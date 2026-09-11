import type { ApiPromise } from "@polkadot/api";
import { Layers, Percent, Shield, ShieldAlert } from "lucide-react";
import { useMixMetrics } from "@/hooks/useMixMetrics";
import { fromPlanck } from "@/lib/format";
import { tokenSymbol } from "@/lib/chain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SYMBOL = tokenSymbol();

function Stat({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  gradient: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-white shadow-sm`}>
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-base font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

export function MixPanel({ api }: { api: ApiPromise | null }) {
  const { metrics, error } = useMixMetrics(api);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Protocol overview</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-muted-foreground">Vault mix metrics unavailable ({error})</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              icon={ShieldAlert}
              label="eDOT backing"
              value={`${fromPlanck(metrics.eDotBacking)} ${SYMBOL}`}
              gradient="from-[#7C3AED] to-[#a855f7]"
            />
            <Stat
              icon={Shield}
              label="oDOT backing"
              value={`${fromPlanck(metrics.oDotBacking)} ${SYMBOL}`}
              gradient="from-[#00D2FF] to-[#22c1dc]"
            />
            <Stat
              icon={Percent}
              label="Self-stake ratio"
              value={`${metrics.phiPercent.toFixed(2)}%`}
              gradient="from-[#00D2FF] to-[#7C3AED]"
            />
            <Stat
              icon={Layers}
              label="Openable slots"
              value={String(metrics.openableSlots)}
              gradient="from-[#7C3AED] to-[#00D2FF]"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

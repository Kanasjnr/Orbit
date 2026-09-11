import type { ApiPromise } from "@polkadot/api";
import { Layers, Percent, Shield, ShieldAlert } from "lucide-react";
import { useMixMetrics } from "@/hooks/useMixMetrics";
import { fromPlanck } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function MixPanel({ api }: { api: ApiPromise | null }) {
  const { metrics, error } = useMixMetrics(api);

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        Vault mix metrics unavailable ({error})
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat icon={ShieldAlert} label="eDOT backing" value={`${fromPlanck(metrics.eDotBacking)} DOT`} />
      <Stat icon={Shield} label="oDOT backing" value={`${fromPlanck(metrics.oDotBacking)} DOT`} />
      <Stat icon={Percent} label="Self-stake ratio" value={`${metrics.phiPercent.toFixed(2)}%`} />
      <Stat icon={Layers} label="Openable slots" value={String(metrics.openableSlots)} />
    </div>
  );
}

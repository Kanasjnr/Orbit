import { AlertTriangle, FileWarning, Lock, TrendingUp } from "lucide-react";

const risks = [
  {
    icon: AlertTriangle,
    title: "Unaudited, testnet only",
    description: "This is a FRAME parachain scaffold under active development. Do not deposit real DOT.",
  },
  {
    icon: TrendingUp,
    title: "eDOT can lose principal",
    description: "A Hub slash against a validator's self-stake hits eDOT only. oDOT's rate never falls from a slash.",
  },
  {
    icon: Lock,
    title: "v1 custody is multisig",
    description: "Stash keys sit under a threshold multisig, not user self-custody. StakingOperator only covers the node-operator side.",
  },
  {
    icon: FileWarning,
    title: "Yields are modeled, not promised",
    description: "Rates shown reflect a modeled weight function pending re-derivation from live Hub staking source — not a guaranteed APY.",
  },
];

export function Risks() {
  return (
    <section id="risks" className="py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Read this before you deposit</h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Full list in the whitepaper's risk disclosures.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {risks.map((risk) => (
            <div key={risk.title} className="flex gap-4 rounded-xl border bg-card p-5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <risk.icon className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold">{risk.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{risk.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

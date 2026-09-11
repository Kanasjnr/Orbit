import { Shield, TrendingUp, Zap } from "lucide-react";

const topFeatures = [
  {
    bg: "/secure.png",
    icon: Shield,
    color: "#00D2FF",
    title: "Unslashable oDOT",
    description: "Nomination-backed shares carry no Hub slash risk.",
  },
  {
    bg: "/liquid.png",
    icon: Zap,
    color: "#7C3AED",
    title: "Always Liquid",
    description: "Redeem instantly from the buffer, or queue full NAV — no lockups.",
  },
  {
    bg: "/frame-yield.png",
    icon: TrendingUp,
    color: "#00C853",
    title: "Self-Stake Yield",
    description: "eDOT captures Polkadot's new self-stake incentive layer.",
  },
];

const gridFeatures = [
  {
    icon: "/icon-liquid-staking.png",
    title: "oDOT Vault",
    description:
      "Deposit DOT, mint oDOT shares that rise in value as nomination rewards accrue. Nominator stake is unslashable post-reform.",
  },
  {
    icon: "/restaking.png",
    title: "eDOT Self-Stake",
    description:
      "Mint eDOT to bond validator self-stake and capture the incentive layer Polkadot added on top of base nomination yield.",
  },
  {
    icon: "/liquidity.png",
    title: "Redeem Your Way",
    description:
      "Take an instant buffer-backed redeem, or queue a full-NAV protocol redeem — your call, not a fixed unbonding wait.",
  },
  {
    icon: "/icon-transparent-rewards.png",
    title: "Rewards, Not Guesses",
    description:
      "Every deposit, reward, and slash event moves through pallet-hub-feed on-chain — your rate reflects real Hub outcomes.",
  },
  {
    icon: "/security.png",
    title: "No Bridges",
    description:
      "Orbit is a FRAME parachain talking directly to Polkadot Hub staking extrinsics. Nothing crosses a bridge to get there.",
  },
  {
    icon: "/growth.png",
    title: "Diversified by Design",
    description:
      "Many small self-stakes beat one large one under Polkadot's concave incentive curve — eDOT spreads thin across slots on purpose.",
  },
];

export function Features() {
  return (
    <>
      <section id="features" className="relative py-16 sm:py-20">
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 hidden h-px -translate-y-1/2 opacity-70 lg:block"
          style={{
            backgroundImage: "url(/connector-lines.png)",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div className="relative mx-auto grid max-w-5xl grid-cols-1 gap-10 px-4 sm:px-6 md:grid-cols-3">
          {topFeatures.map((feature) => (
            <div key={feature.title} className="flex flex-col items-center text-center">
              <div className="relative flex size-24 items-center justify-center">
                <img src={feature.bg} alt="" className="size-full object-contain" />
                <feature.icon className="absolute size-10" style={{ color: feature.color }} />
              </div>
              <h3 className="mt-3 bg-gradient-to-r from-[#00D2FF] to-[#7C3AED] bg-clip-text text-xl font-bold text-transparent">
                {feature.title}
              </h3>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-muted/40 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              Unlock the power of{" "}
              <span className="bg-gradient-to-r from-[#00D2FF] to-[#7C3AED] bg-clip-text text-transparent">
                liquid staking
              </span>
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Orbit turns staking into a product: liquidity, composability, and Polkadot's new
              self-stake incentive layer, all in one deposit.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {gridFeatures.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
              >
                <img src={card.icon} alt="" className="mb-4 size-12 rounded-xl sm:mb-6 sm:size-14" />
                <h3 className="mb-2 text-xl font-bold sm:mb-3">{card.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

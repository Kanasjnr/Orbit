const steps = [
  {
    number: "01",
    title: "Connect & Deposit",
    description: "Connect Talisman or SubWallet and deposit DOT into the vault of your choice.",
    color: "#00D2FF",
  },
  {
    number: "02",
    title: "Mint oDOT or eDOT",
    description: "Shares mint at the live V/S exchange rate — no fixed price, no waiting.",
    color: "#7C3AED",
  },
  {
    number: "03",
    title: "Orbit Stakes on Hub",
    description: "The protocol nominates or bonds your DOT via StakingOperator-run validators.",
    color: "#00D2FF",
  },
  {
    number: "04",
    title: "Hold or Redeem",
    description: "Watch the rate rise as rewards land, or redeem instantly and queue a full exit.",
    color: "#7C3AED",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
          <h2 className="text-3xl font-bold sm:text-4xl lg:text-5xl">How liquid staking works</h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Four steps, no unbonding wait to check your balance, no manual validator picking.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.number} className="rounded-2xl border bg-card p-6 shadow-sm">
              <div
                className="flex size-12 items-center justify-center rounded-lg text-lg font-bold text-white"
                style={{ background: step.color }}
              >
                {step.number}
              </div>
              <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

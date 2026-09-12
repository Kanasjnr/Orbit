import { Card, CardContent } from "@/components/ui/card";

const steps = [
  {
    number: "01",
    title: "Connect & Deposit",
    description: "Connect your wallet and deposit your DOT tokens through the Orbit protocol interface.",
  },
  {
    number: "02",
    title: "Mint oDOT or eDOT",
    description: "Receive liquid oDOT or eDOT tokens representing your staked position, maintaining full DeFi composability.",
  },
  {
    number: "03",
    title: "Orbit Stakes on Hub",
    description: "Orbit nominates or bonds your DOT through StakingOperator-run validators on Polkadot Hub.",
  },
  {
    number: "04",
    title: "Hold or Redeem",
    description: "Watch your rate rise as rewards land, or redeem instantly and queue a full protocol exit.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-gray-100 py-16 lg:px-20 px-6 w-full mt-[100px] mb-[100px]">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left side - background with text overlay */}
          <div className="relative lg:h-[1150px] h-max py-6 ">
            <div className="bg-[url('/how-it-works.png')] lg:w-[120vw] lg:h-[1400px] w-[90vw] h-full bg-no-repeat bg-cover absolute lg:left-[-100%] opacity-20 hidden lg:block"></div>
            <div className="sticky top-0 inset-0 flex flex-col justify-center pl-0 lg:pl-12 lg:-mt-8 -mt-4">
              <h2
                className="text-3xl lg:text-6xl font-bold lg:mb-2 mb-1 lg:text-left text-center font-[Gotham] lg:ml-8"
                style={{ color: "#1C1C1C" }}
              >
                How it works
              </h2>
              <p
                className="text-xl lg:max-w-md px-2 lg:px-0 lg:text-left text-center lg:ml-8 font-[Gotham]"
                style={{ color: "#1C1C1C80" }}
              >
                Experience seamless liquid staking in four simple steps. No complex processes, no
                lengthy wait times, just efficient capital deployment.
              </p>
            </div>
          </div>

          {/* Right side - Step cards */}
          <div className="flex flex-col gap-5 lg:items-end items-center justify-center">
            {steps.map((step, index) => (
              <Card
                key={index}
                className="bg-white border-[#69696966] border-[1px] w-[356px] h-[298px] rounded-[20px] p-[30px]"
              >
                <CardContent className="p-0 h-full">
                  <div className="flex items-center gap-4 flex-col justify-center ">
                    <div
                      className="text-white w-[60px] h-[60px] rounded-lg flex items-center justify-center font-bold text-xl flex-shrink-0 font-[Gotham]"
                      style={{
                        background: index % 2 === 0 ? "#00D2FF" : "#7C3AED",
                        boxShadow: "0px 4px 4px 0px #00000040",
                      }}
                    >
                      {step.number}
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <h3 className="text-2xl font-bold mb-2 font-[Gotham]" style={{ color: "#1C1C1C" }}>
                        {step.title}
                      </h3>
                      <p className="text-lg leading-relaxed text-center font-[Gotham]" style={{ color: "#1C1C1C80" }}>
                        {step.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

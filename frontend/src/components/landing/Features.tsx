import { Shield, TrendingUp, Zap } from "lucide-react";

const gridCards = [
  {
    icon: "/icon-liquid-staking.png",
    title: "Liquid Staking",
    description:
      "Stake DOT and receive oDOT liquid tokens that maintain DeFi composability while earning staking rewards.",
  },
  {
    icon: "/restaking.png",
    title: "Self-Stake Yield",
    description:
      "Mint eDOT to bond validator self-stake into Polkadot's new incentive layer for enhanced yield generation.",
  },
  {
    icon: "/liquidity.png",
    title: "No Liquidity Lockups",
    description: "Trade, lend, or use oDOT in DeFi protocols immediately without waiting for unbonding periods.",
  },
  {
    icon: "/icon-transparent-rewards.png",
    title: "Transparent Rewards",
    description:
      "Track every reward and slash event through pallet-hub-feed on-chain, with complete transparency and real-time updates.",
  },
  {
    icon: "/security.png",
    title: "Native Security",
    description: "Built natively on Polkadot with no bridge dependencies, ensuring maximum security and decentralization.",
  },
  {
    icon: "/growth.png",
    title: "Ecosystem Growth",
    description: "Participate in Polkadot staking expansion while contributing to network security and earning rewards.",
  },
];

export function Features() {
  return (
    <>
      {/* First Section - Three Features with Background */}
      <section
        className="relative hidden lg:block"
        style={{
          height: "222.5px",
          left: "50%",
          transform: "translateX(-50%)",
          marginTop: "100px",
          opacity: 1,
          marginBottom: "80px",
          backgroundImage: "url('/connector-lines.png')",
          backgroundSize: "contain",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="container mx-auto px-6">
          {/* Features Grid */}
          <div className="relative max-w-6xl mx-auto" style={{ minHeight: "300px" }}>
            {/* Secure Feature */}
            <div
              className="text-center absolute"
              style={{
                width: "224px",
                height: "183px",
                top: "87px",
                left: "20px",
                opacity: 1,
                gap: "20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div className="flex justify-center mb-3">
                <div className="relative w-[95px] h-[95px] flex items-center justify-center">
                  <img src="/secure.png" alt="Secure Background" width={95} height={95} className="w-full h-full object-contain" />
                  <Shield className="w-12 h-12 absolute" style={{ color: "#00D2FF" }} />
                </div>
              </div>
              <h3
                className="text-3xl font-bold mb-1 font-[Gotham]"
                style={{
                  background: "linear-gradient(92deg, #00D2FF 1.69%, #7C3AED 101.93%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  marginTop: "-20px",
                  marginLeft: "20px",
                }}
              >
                Unslashable
              </h3>
              <p
                className="max-w-xs mx-auto font-[Gotham]"
                style={{
                  fontWeight: 325,
                  fontSize: "20px",
                  lineHeight: "100%",
                  letterSpacing: "0%",
                  textAlign: "center",
                  color: "#1C1C1C80",
                  marginLeft: "20px",
                  marginTop: "-15px",
                }}
              >
                Nomination-backed oDOT carries no Hub slash risk
              </p>
            </div>

            {/* Liquid Feature - Center */}
            <div
              className="text-center absolute"
              style={{
                width: "224px",
                height: "183px",
                top: "-60px",
                left: "50%",
                transform: "translateX(-50%)",
                opacity: 1,
                gap: "8px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div className="flex justify-center mb-1" style={{ marginTop: "20px" }}>
                <div className="relative w-[95px] h-[95px] flex items-center justify-center">
                  <img src="/liquid.png" alt="Liquid Background" width={95} height={95} className="w-full h-full object-contain" />
                  <Zap
                    className="text-purple-600 absolute"
                    style={{
                      width: "32.14285659790039px",
                      height: "46.42856979370117px",
                      borderRadius: "4px",
                      opacity: 1,
                    }}
                  />
                </div>
              </div>
              <h3
                className="text-3xl font-bold mb-1 font-[Gotham]"
                style={{
                  background: "linear-gradient(92deg, #00D2FF 1.69%, #7C3AED 101.93%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Liquid
              </h3>
              <p
                className="max-w-xs mx-auto font-[Gotham]"
                style={{
                  fontWeight: 325,
                  fontSize: "20px",
                  lineHeight: "100%",
                  letterSpacing: "0%",
                  textAlign: "center",
                  color: "#1C1C1C80",
                }}
              >
                No lockups, maintain DeFi composability
              </p>
            </div>

            {/* High Yield Feature */}
            <div
              className="text-center absolute"
              style={{
                width: "224px",
                height: "183px",
                top: "87px",
                right: "20px",
                opacity: 1,
                gap: "20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div className="flex justify-center mb-3">
                <div className="relative w-[95px] h-[95px] flex items-center justify-center">
                  <img src="/frame-yield.png" alt="High Yield Background" width={95} height={95} className="w-full h-full object-contain" />
                  <TrendingUp className="w-12 h-12 absolute" style={{ color: "#00FF22" }} />
                </div>
              </div>
              <h3
                className="text-3xl font-bold mb-1 font-[Gotham]"
                style={{
                  background: "linear-gradient(92deg, #00D2FF 1.69%, #7C3AED 101.93%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  marginTop: "-20px",
                  marginLeft: "20px",
                }}
              >
                High Yield
              </h3>
              <p
                className="max-w-xs mx-auto font-[Gotham]"
                style={{
                  fontWeight: 325,
                  fontSize: "20px",
                  lineHeight: "100%",
                  letterSpacing: "0%",
                  textAlign: "center",
                  color: "#1C1C1C80",
                  marginLeft: "20px",
                  marginTop: "-15px",
                }}
              >
                Maximize returns through self-stake incentives
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 lg:hidden">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 max-w-6xl mx-auto">
            {/* Secure Feature */}
            <div className="text-center flex flex-col items-center space-y-4 md:space-y-6">
              <div className="flex justify-center">
                <div className="relative w-16 h-16 md:w-20 md:h-20 flex items-center justify-center">
                  <img src="/secure.png" alt="Secure Background" width={80} height={80} className="w-full h-full object-contain" />
                  <Shield className="w-8 h-8 md:w-10 md:h-10 absolute" style={{ color: "#00D2FF" }} />
                </div>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#00D2FF] to-[#7C3AED] bg-clip-text text-transparent font-[Gotham]">
                Unslashable
              </h3>
              <p className="text-base md:text-lg text-gray-600 max-w-xs mx-auto leading-relaxed text-center font-[Gotham]">
                Nomination-backed oDOT carries no Hub slash risk
              </p>
            </div>

            {/* Liquid Feature - Center */}
            <div className="text-center flex flex-col items-center space-y-4 md:space-y-6">
              <div className="flex justify-center">
                <div className="relative w-16 h-16 md:w-20 md:h-20 flex items-center justify-center">
                  <img src="/liquid.png" alt="Liquid Background" width={80} height={80} className="w-full h-full object-contain" />
                  <Zap className="w-8 h-8 md:w-10 md:h-10 text-purple-600 absolute" />
                </div>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#00D2FF] to-[#7C3AED] bg-clip-text text-transparent font-[Gotham]">
                Liquid
              </h3>
              <p className="text-base md:text-lg text-gray-600 max-w-xs mx-auto leading-relaxed text-center font-[Gotham]">
                No lockups, maintain DeFi composability
              </p>
            </div>

            {/* High Yield Feature */}
            <div className="text-center flex flex-col items-center space-y-4 md:space-y-6">
              <div className="flex justify-center">
                <div className="relative w-16 h-16 md:w-20 md:h-20 flex items-center justify-center">
                  <img src="/frame-yield.png" alt="High Yield Background" width={80} height={80} className="w-full h-full object-contain" />
                  <TrendingUp className="w-8 h-8 md:w-10 md:h-10 absolute" style={{ color: "#00FF22" }} />
                </div>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#00D2FF] to-[#7C3AED] bg-clip-text text-transparent font-[Gotham]">
                High Yield
              </h3>
              <p className="text-base md:text-lg text-gray-600 max-w-xs mx-auto leading-relaxed text-center font-[Gotham]">
                Maximize returns through self-stake incentives
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Second Section - Header and 6-Card Grid */}
      <section id="features" className="py-12 md:py-16 lg:py-24 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16 lg:mb-20">
            <h2 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 md:mb-6 leading-tight font-[Gotham]">
              Unlock the Power of{" "}
              <span className="bg-gradient-to-r from-[#00D2FF] to-[#7C3AED] bg-clip-text text-transparent font-[Gotham]">
                Liquid Staking
              </span>
            </h2>
            <p
              className="text-lg md:text-xl lg:text-2xl max-w-4xl mx-auto leading-relaxed text-gray-600 px-4 font-[Gotham]"
              style={{ fontWeight: 325 }}
            >
              Orbit transforms traditional staking by providing liquidity, composability, and
              enhanced yield opportunity on Polkadot.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-10 max-w-7xl mx-auto">
            {gridCards.map((card) => (
              <div
                key={card.title}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 md:p-8 hover:shadow-xl transition-shadow duration-300"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl mb-4 md:mb-6 overflow-hidden">
                  <img src={card.icon} alt={card.title} width={64} height={64} className="w-full h-full object-cover" />
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 md:mb-4 leading-tight font-[Gotham]">
                  {card.title}
                </h3>
                <p
                  className="leading-relaxed font-[Gotham]"
                  style={{
                    fontWeight: 325,
                    fontSize: "20px",
                    lineHeight: "100%",
                    letterSpacing: "0%",
                    color: "#1C1C1C80",
                  }}
                >
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WaitlistModal } from "@/components/landing/WaitlistModal";
import { useWallet } from "@/context/WalletProvider";

export function Hero() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);
  const { connect, connecting, walletError } = useWallet();
  const navigate = useNavigate();

  const handleConnect = async () => {
    const ok = await connect();
    if (ok) navigate("/dashboard");
  };

  return (
    <div
      className="min-h-screen bg-white relative overflow-hidden font-sans"
      style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
    >
      {/* Main blue gradient background blob */}
      <div
        className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/3 w-[800px] md:w-[1200px] lg:w-[1400px] h-[600px] md:h-[800px] lg:h-[1000px]"
        style={{
          backgroundImage: "url(/shield.png)",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          opacity: 0.8,
        }}
      ></div>

      {/* Floating golden oval shapes */}
      <img
        src="/floating-particles.png"
        alt=""
        className="absolute opacity-100 pointer-events-none"
        style={{
          width: "100vw",
          height: "100vh",
          top: "0",
          left: "0",
          transform: "rotate(0deg)",
          filter: "blur(1px)",
          zIndex: 25,
          objectFit: "cover",
        }}
      />

      {/* Navigation */}
      <nav className="relative z-30 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-16 py-4 max-w-7xl mx-auto">
          {/* Brand */}
          <div className="flex flex-col">
            <div
              className="bg-clip-text text-transparent text-xl sm:text-2xl lg:text-3xl"
              style={{
                background: "linear-gradient(92deg, #00D2FF 1.69%, #7C3AED 101.93%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontFamily: "Gotham",
                fontWeight: 350,
                lineHeight: "100%",
                letterSpacing: "0%",
              }}
            >
              Orbit
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center space-x-8">
            <a
              href="#features"
              className="hover:text-gray-900 transition-colors duration-200 text-base xl:text-lg"
              style={{
                fontFamily: "Gotham",
                fontWeight: 325,
                lineHeight: "100%",
                letterSpacing: "0%",
                color: "#1C1C1C",
                textDecoration: "none",
              }}
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="hover:text-gray-900 transition-colors duration-200 text-base xl:text-lg"
              style={{
                fontFamily: "Gotham",
                fontWeight: 325,
                lineHeight: "100%",
                letterSpacing: "0%",
                color: "#1C1C1C",
                textDecoration: "none",
              }}
            >
              How it works
            </a>
            <a
              href="https://github.com/Kanasjnr/Orbit/blob/main/WHITEPAPER.md"
              className="hover:text-gray-900 transition-colors duration-200 text-base xl:text-lg"
              style={{
                fontFamily: "Gotham",
                fontWeight: 325,
                lineHeight: "100%",
                letterSpacing: "0%",
                color: "#1C1C1C",
                textDecoration: "none",
              }}
            >
              Docs
            </a>
          </div>

          {/* Desktop Action Button */}
          <div className="hidden sm:flex items-center">
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="hover:shadow-lg transition-all duration-200 px-4 py-2 sm:px-6 sm:py-3 rounded-lg text-sm sm:text-base"
              style={{
                background: "linear-gradient(99.92deg, rgba(0, 210, 255, 0.95) 5.17%, rgba(124, 58, 237, 0.95) 100.44%)",
                fontFamily: "Gotham",
                fontWeight: 700,
                lineHeight: "100%",
                letterSpacing: "0%",
                textAlign: "center",
                color: "white",
                border: "none",
              }}
            >
              {connecting ? "Connecting..." : "Connect wallet"}
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100">
            <div className="px-4 py-2 space-y-1">
              <a
                href="#features"
                className="block px-3 py-2 text-gray-900 hover:bg-gray-50 rounded-md"
                style={{ fontFamily: "Gotham", fontWeight: 325 }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="block px-3 py-2 text-gray-900 hover:bg-gray-50 rounded-md"
                style={{ fontFamily: "Gotham", fontWeight: 325 }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                How it works
              </a>
              <a
                href="https://github.com/Kanasjnr/Orbit/blob/main/WHITEPAPER.md"
                className="block px-3 py-2 text-gray-900 hover:bg-gray-50 rounded-md"
                style={{ fontFamily: "Gotham", fontWeight: 325 }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Docs
              </a>
              <div className="pt-2">
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full hover:shadow-lg transition-all duration-200 px-4 py-3 rounded-lg text-sm"
                  style={{
                    background: "linear-gradient(99.92deg, rgba(0, 210, 255, 0.95) 5.17%, rgba(124, 58, 237, 0.95) 100.44%)",
                    fontFamily: "Gotham",
                    fontWeight: 700,
                    lineHeight: "100%",
                    letterSpacing: "0%",
                    textAlign: "center",
                    color: "white",
                    border: "none",
                  }}
                >
                  {connecting ? "Connecting..." : "Connect wallet"}
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Content */}
      <main className="relative z-20 flex flex-col items-center justify-center text-center px-4 sm:px-8 pt-16 sm:pt-24 lg:pt-32 pb-16 sm:pb-24 lg:pb-32 max-w-7xl mx-auto">
        {/* Main Heading */}
        <h1 className="mb-6 sm:mb-8">
          <div
            className="text-gray-900 mb-4 sm:mb-6 text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl"
            style={{
              fontFamily: "Gotham, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              fontWeight: 700,
              lineHeight: "100%",
              letterSpacing: "0%",
              textAlign: "center",
            }}
          >
            Redefine Your Staked DOT
          </div>
          <div
            className="text-gray-900 text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl"
            style={{
              fontFamily: "Gotham, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              fontWeight: 700,
              lineHeight: "100%",
              letterSpacing: "0%",
              textAlign: "center",
            }}
          >
            with{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                background: "linear-gradient(to right, #3ecbff, #3b82f6, #6c4cff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontFamily: "Gotham, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                fontWeight: 700,
                lineHeight: "100%",
                letterSpacing: "0%",
              }}
            >
              Liquid Staking
            </span>
          </div>
        </h1>

        {/* Subtitle */}
        <p
          className="max-w-4xl mx-auto mb-8 sm:mb-12 lg:mb-16 text-sm sm:text-lg md:text-xl lg:text-2xl px-4"
          style={{
            color: "#1C1C1C80",
            fontFamily: "Gotham",
            fontWeight: 325,
            lineHeight: "130%",
            letterSpacing: "0%",
            textAlign: "center",
          }}
        >
          Stake DOT, mint liquid oDOT or eDOT tokens, and unlock seamless DeFi opportunities on
          <br className="hidden sm:block" />
          <span className="sm:hidden"> </span>
          Polkadot without lockups or bridge dependencies
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <button
            onClick={() => setIsWaitlistOpen(true)}
            className="w-full sm:w-auto hover:shadow-xl transition-all duration-300 flex items-center justify-center font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-sm sm:text-base"
            style={{
              background: "linear-gradient(to right, #3ecbff, #6c4cff)",
              color: "#F5F5F5",
              border: "none",
              minWidth: "180px",
            }}
          >
            <span>Join waitlist</span>
            <svg className="w-4 h-4 sm:w-5 sm:h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>

          <a
            href="#features"
            className="w-full sm:w-auto border border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all duration-300 font-semibold flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-sm sm:text-base"
            style={{
              minWidth: "180px",
            }}
          >
            Explore protocol
          </a>
        </div>

        {walletError && <p className="mt-4 text-sm text-red-500">{walletError}</p>}
      </main>

      <WaitlistModal isOpen={isWaitlistOpen} onClose={() => setIsWaitlistOpen(false)} />
    </div>
  );
}

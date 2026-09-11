import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/context/WalletProvider";

export function Hero() {
  const { connect, connecting } = useWallet();
  const navigate = useNavigate();

  const handleConnect = async () => {
    const ok = await connect();
    if (ok) navigate("/dashboard");
  };

  return (
    <section id="top" className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[700px] w-[1100px] -translate-x-1/2 -translate-y-1/3 opacity-60"
        style={{
          backgroundImage: "url(/shield.png)",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }}
      />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
        <h1 className="text-4xl font-bold leading-tight text-foreground sm:text-6xl lg:text-7xl">
          Stake DOT.
          <br />
          Stay{" "}
          <span className="bg-gradient-to-r from-[#00D2FF] to-[#7C3AED] bg-clip-text text-transparent">
            Liquid.
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Deposit DOT, mint oDOT or eDOT, and keep using it across Polkadot DeFi &mdash; instant or
          queued redeem, no bridges, no waiting to just check your balance.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Button
            size="lg"
            onClick={handleConnect}
            disabled={connecting}
            className="bg-gradient-to-r from-[#00D2FF] to-[#7C3AED] text-white hover:opacity-90"
          >
            {connecting ? "Connecting..." : "Connect wallet"}
            <ArrowRight />
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="https://github.com/Kanasjnr/Orbit/blob/main/WHITEPAPER.md">Read the whitepaper</a>
          </Button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Testnet PoC. Not audited. Not mainnet. Do not deposit real DOT.
        </p>
      </div>
    </section>
  );
}

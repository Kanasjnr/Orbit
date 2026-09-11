import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/context/WalletProvider";

export function CtaBanner() {
  const { connect, connecting } = useWallet();
  const navigate = useNavigate();

  const handleConnect = async () => {
    const ok = await connect();
    if (ok) navigate("/dashboard");
  };

  return (
    <section
      className="relative overflow-hidden py-20 text-center sm:py-24"
      style={{
        background: "#1A1B3A",
        backgroundImage: "url(/ellipse.png)",
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="relative mx-auto max-w-2xl px-4 sm:px-6">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">Ready to put your DOT to work?</h2>
        <p className="mt-3 text-slate-300">Connect a wallet and mint oDOT or eDOT in one deposit.</p>
        <Button
          size="lg"
          onClick={handleConnect}
          disabled={connecting}
          className="mt-8 bg-gradient-to-r from-[#00D2FF] to-[#7C3AED] text-white hover:opacity-90"
        >
          {connecting ? "Connecting..." : "Connect wallet"}
          <ArrowRight />
        </Button>
      </div>
    </section>
  );
}

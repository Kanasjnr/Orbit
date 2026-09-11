import { Menu, Orbit, Wallet, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/context/WalletProvider";

const links = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Risks", href: "#risks" },
];

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { connect, connecting, walletError } = useWallet();
  const navigate = useNavigate();

  const handleConnect = async () => {
    const ok = await connect();
    if (ok) navigate("/dashboard");
  };

  return (
    <nav className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Orbit className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="bg-gradient-to-r from-[#00D2FF] to-[#7C3AED] bg-clip-text text-lg font-bold text-transparent">
              Orbit
            </p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Liquid staking</p>
          </div>
        </a>

        <div className="hidden items-center gap-8 lg:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-foreground/80 hover:text-foreground">
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden sm:flex sm:flex-col sm:items-end">
          <Button
            onClick={handleConnect}
            disabled={connecting}
            className="bg-gradient-to-r from-[#00D2FF] to-[#7C3AED] text-white hover:opacity-90"
          >
            <Wallet />
            {connecting ? "Connecting..." : "Connect wallet"}
          </Button>
          {walletError && <p className="mt-1 text-xs text-destructive">{walletError}</p>}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-md p-2 text-foreground/70 hover:bg-accent lg:hidden"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t bg-background px-4 py-3 lg:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm hover:bg-accent"
              >
                {link.label}
              </a>
            ))}
          </div>
          <Button
            onClick={handleConnect}
            disabled={connecting}
            className="mt-3 w-full bg-gradient-to-r from-[#00D2FF] to-[#7C3AED] text-white hover:opacity-90"
          >
            <Wallet />
            {connecting ? "Connecting..." : "Connect wallet"}
          </Button>
        </div>
      )}
    </nav>
  );
}

import { Orbit } from "lucide-react";
import { Link } from "react-router-dom";
import { MixPanel } from "@/components/MixPanel";
import { VaultPanel } from "@/components/VaultPanel";
import { WalletConnect } from "@/components/WalletConnect";
import { useWallet } from "@/context/WalletProvider";

export function Dashboard() {
  const { api, chainError, endpoint, accounts, selected, signer, connect, select, connecting, walletError } =
    useWallet();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Orbit className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Orbit</h1>
              <p className="text-xs text-muted-foreground">Liquid staking for Polkadot &middot; {endpoint}</p>
            </div>
          </Link>
          <WalletConnect
            accounts={accounts}
            selected={selected}
            onSelect={select}
            onConnect={connect}
            connecting={connecting}
            error={walletError}
          />
        </header>

        {chainError && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            Chain connection failed: {chainError}
          </p>
        )}

        <MixPanel api={api} />

        <main className="grid gap-5 md:grid-cols-2">
          <VaultPanel api={api} kind="odot" label="oDOT" account={selected} signer={signer} />
          <VaultPanel api={api} kind="edot" label="eDOT" account={selected} signer={signer} />
        </main>

        <footer className="pt-4 text-center text-xs text-muted-foreground">
          Testnet PoC. Not audited. Not mainnet. Do not deposit real DOT.
        </footer>
      </div>
    </div>
  );
}

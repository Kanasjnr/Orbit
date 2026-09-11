import { AlertTriangle, Orbit } from "lucide-react";
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

        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Unaudited testnet PoC &mdash; do not deposit real DOT. eDOT can lose principal to a Hub
            slash (oDOT cannot); v1 stash custody is a multisig, not user self-custody; shown rates
            are modeled, not a guaranteed APY.
          </p>
        </div>

        <MixPanel api={api} />

        <main className="grid gap-5 md:grid-cols-2">
          <VaultPanel api={api} kind="odot" label="oDOT" account={selected} signer={signer} />
          <VaultPanel api={api} kind="edot" label="eDOT" account={selected} signer={signer} />
        </main>
      </div>
    </div>
  );
}

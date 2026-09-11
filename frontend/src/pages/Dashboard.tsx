import { AlertTriangle, Loader2, Orbit, Radio, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { MixPanel } from "@/components/MixPanel";
import { VaultPanel } from "@/components/VaultPanel";
import { WalletConnect } from "@/components/WalletConnect";
import { useWallet } from "@/context/WalletProvider";
import { useBlockNumber } from "@/hooks/useBlockNumber";
import { networkName, orbitWsEndpoint } from "@/lib/chain";
import { Button } from "@/components/ui/button";

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[#00D2FF] to-[#7C3AED] text-white shadow-sm">
            <Orbit className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="bg-gradient-to-r from-[#00D2FF] to-[#7C3AED] bg-clip-text text-lg font-bold leading-tight text-transparent">
                Orbit
              </p>
              <span className="rounded-full border border-dashed border-amber-500/50 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                {networkName()}
              </span>
            </div>
          </div>
        </Link>
        <WalletConnectSlot />
      </div>
    </header>
  );
}

function WalletConnectSlot() {
  const { accounts, selected, select, connect, connecting, walletError } = useWallet();
  return (
    <WalletConnect
      accounts={accounts}
      selected={selected}
      onSelect={select}
      onConnect={connect}
      connecting={connecting}
      error={walletError}
    />
  );
}

function ConnectingState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <p className="text-sm font-medium">Connecting to Orbit</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Waiting for a node at <code className="rounded bg-muted px-1 py-0.5">{orbitWsEndpoint()}</code>. Make sure
        the collator is running.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <WifiOff className="size-6" />
      </div>
      <p className="text-sm font-medium">Couldn&apos;t reach Orbit</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        {message} &mdash; endpoint: <code className="rounded bg-muted px-1 py-0.5">{orbitWsEndpoint()}</code>
      </p>
      <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
        Retry
      </Button>
    </div>
  );
}

export function Dashboard() {
  const { api, chainError } = useWallet();
  const blockNumber = useBlockNumber(api);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-muted/40">
      <Header />

      {chainError ? (
        <ErrorState message={chainError} />
      ) : !api ? (
        <ConnectingState />
      ) : (
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Radio className="size-3 text-emerald-500" />
            Live &middot; block #{blockNumber ?? "…"}
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              Unaudited testnet PoC on {networkName()} &mdash; deposits are testnet tokens, not real DOT. eDOT can
              lose principal to a Hub slash (oDOT cannot); v1 stash custody is a multisig, not user self-custody;
              shown rates are modeled, not a guaranteed APY.
            </p>
          </div>

          <MixPanel api={api} />

          <main className="grid gap-5 md:grid-cols-2">
            <VaultPanel api={api} kind="odot" label="oDOT" />
            <VaultPanel api={api} kind="edot" label="eDOT" />
          </main>
        </div>
      )}
    </div>
  );
}

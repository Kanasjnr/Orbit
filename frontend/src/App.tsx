import type { ApiPromise } from "@polkadot/api";
import type { Signer } from "@polkadot/api/types";
import type { InjectedAccountWithMeta } from "@polkadot/extension-inject/types";
import { Orbit } from "lucide-react";
import { useEffect, useState } from "react";
import { MixPanel } from "@/components/MixPanel";
import { VaultPanel } from "@/components/VaultPanel";
import { WalletConnect } from "@/components/WalletConnect";
import { getApi, orbitWsEndpoint } from "@/lib/chain";
import { connectWallet, getSigner } from "@/lib/wallet";

function App() {
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [chainError, setChainError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<InjectedAccountWithMeta[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  useEffect(() => {
    getApi()
      .then(setApi)
      .catch((err) => setChainError((err as Error).message));
  }, []);

  useEffect(() => {
    if (!selected) {
      setSigner(null);
      return;
    }
    getSigner(selected).then(setSigner);
  }, [selected]);

  const handleConnect = async () => {
    setConnecting(true);
    setWalletError(null);
    try {
      const found = await connectWallet();
      setAccounts(found);
      if (found.length > 0) setSelected(found[0].address);
    } catch (err) {
      setWalletError((err as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Orbit className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Orbit</h1>
              <p className="text-xs text-muted-foreground">Liquid staking for Polkadot &middot; {orbitWsEndpoint()}</p>
            </div>
          </div>
          <WalletConnect
            accounts={accounts}
            selected={selected}
            onSelect={setSelected}
            onConnect={handleConnect}
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

export default App;

import type { ApiPromise } from "@polkadot/api";
import type { Signer } from "@polkadot/api/types";
import type { InjectedAccountWithMeta } from "@polkadot/extension-inject/types";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getApi, orbitWsEndpoint } from "@/lib/chain";
import { getHubApi, HUB_SIGNED_EXTENSIONS, hubWsEndpoint } from "@/lib/hubChain";
import { connectWallet, getSigner, provideChainMetadata } from "@/lib/wallet";

interface WalletContextValue {
  api: ApiPromise | null;
  chainError: string | null;
  endpoint: string;
  hubApi: ApiPromise | null;
  hubChainError: string | null;
  hubEndpoint: string;
  accounts: InjectedAccountWithMeta[];
  selected: string | null;
  signer: Signer | null;
  connecting: boolean;
  walletError: string | null;
  connect: () => Promise<boolean>;
  select: (address: string) => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [chainError, setChainError] = useState<string | null>(null);
  const [hubApi, setHubApi] = useState<ApiPromise | null>(null);
  const [hubChainError, setHubChainError] = useState<string | null>(null);
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
    getHubApi()
      .then(setHubApi)
      .catch((err) => setHubChainError((err as Error).message));
  }, []);

  useEffect(() => {
    if (!selected || !api || !hubApi) {
      setSigner(null);
      return;
    }
    let cancelled = false;
    Promise.allSettled([
      provideChainMetadata(api, selected),
      provideChainMetadata(hubApi, selected, HUB_SIGNED_EXTENSIONS),
    ]).then(() => {
      if (cancelled) return;
      getSigner(selected).then((s) => !cancelled && setSigner(s));
    });
    return () => {
      cancelled = true;
    };
  }, [selected, api, hubApi]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setWalletError(null);
    try {
      const found = await connectWallet();
      setAccounts(found);
      if (found.length > 0) {
        setSelected(found[0].address);
        return true;
      }
      return false;
    } catch (err) {
      setWalletError((err as Error).message);
      return false;
    } finally {
      setConnecting(false);
    }
  }, []);

  return (
    <WalletContext.Provider
      value={{
        api,
        chainError,
        endpoint: orbitWsEndpoint(),
        hubApi,
        hubChainError,
        hubEndpoint: hubWsEndpoint(),
        accounts,
        selected,
        signer,
        connecting,
        walletError,
        connect,
        select: setSelected,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

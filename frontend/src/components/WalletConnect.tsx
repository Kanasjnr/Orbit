import { Wallet } from "lucide-react";
import type { InjectedAccountWithMeta } from "@polkadot/extension-inject/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  accounts: InjectedAccountWithMeta[];
  selected: string | null;
  onSelect: (address: string) => void;
  onConnect: () => void;
  connecting: boolean;
  error: string | null;
}

export function WalletConnect({ accounts, selected, onSelect, onConnect, connecting, error }: Props) {
  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button onClick={onConnect} disabled={connecting}>
          <Wallet />
          {connecting ? "Connecting..." : "Connect wallet"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <Select value={selected ?? undefined} onValueChange={onSelect}>
      <SelectTrigger className="w-56">
        <Wallet className="text-muted-foreground" />
        <SelectValue placeholder="Select account" />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.address} value={account.address}>
            {account.meta.name ?? account.address}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

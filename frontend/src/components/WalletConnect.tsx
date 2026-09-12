import { Wallet } from "lucide-react";
import type { InjectedAccountWithMeta } from "@polkadot/extension-inject/types";
import { truncateAddress } from "@/lib/format";
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
        <Button onClick={onConnect} disabled={connecting} className="bg-gradient-to-r from-[#00D2FF] to-[#7C3AED] text-white hover:opacity-90">
          <Wallet />
          {connecting ? "Connecting..." : "Connect wallet"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  const selectedAccount = accounts.find((a) => a.address === selected);

  return (
    <Select value={selected ?? undefined} onValueChange={onSelect}>
      <SelectTrigger className="w-56">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00D2FF] to-[#7C3AED]">
          <Wallet className="size-3 text-white" />
        </span>
        <SelectValue placeholder="Select account">
          {selectedAccount ? selectedAccount.meta.name ?? truncateAddress(selectedAccount.address) : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.address} value={account.address}>
            {account.meta.name ?? truncateAddress(account.address)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

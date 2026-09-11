import type { ApiPromise } from "@polkadot/api";
import type { Signer } from "@polkadot/api/types";
import { ArrowDownToLine, ArrowUpFromLine, ShieldCheck, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { assetsFor, useVault, type VaultKind } from "@/hooks/useVault";
import { fromPlanck, toPlanck } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Props {
  api: ApiPromise | null;
  kind: VaultKind;
  label: string;
  account: string | null;
  signer: Signer | null;
}

const copy = {
  odot: {
    description: "Nomination-backed, no Hub slash",
    badge: { text: "Unslashable", icon: ShieldCheck, variant: "secondary" as const },
  },
  edot: {
    description: "Validator self-stake, slash exposed",
    badge: { text: "Slashable", icon: ShieldAlert, variant: "destructive" as const },
  },
};

export function VaultPanel({ api, kind, label, account, signer }: Props) {
  const vault = useVault(api, kind, account);
  const [depositAmount, setDepositAmount] = useState("");
  const [redeemAmount, setRedeemAmount] = useState("");

  const heldAssets = assetsFor(vault.shares, vault.totalAssets, vault.totalShares);
  const rate = vault.totalShares.isZero()
    ? "-"
    : (Number(vault.totalAssets.toString()) / Number(vault.totalShares.toString())).toFixed(4);

  const canSubmit = Boolean(api && account && signer && !vault.busy);
  const meta = copy[kind];
  const BadgeIcon = meta.badge.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{label}</CardTitle>
          <Badge variant={meta.badge.variant}>
            <BadgeIcon />
            {meta.badge.text}
          </Badge>
        </div>
        <CardDescription>{meta.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/40 p-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Shares</p>
            <p className="font-semibold tabular-nums">{fromPlanck(vault.shares)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Redeemable</p>
            <p className="font-semibold tabular-nums">{fromPlanck(heldAssets)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rate (V/S)</p>
            <p className="font-semibold tabular-nums">{rate}</p>
          </div>
        </div>

        <Tabs defaultValue="deposit">
          <TabsList className="w-full">
            <TabsTrigger value="deposit">Deposit</TabsTrigger>
            <TabsTrigger value="redeem">Redeem</TabsTrigger>
          </TabsList>

          <TabsContent value="deposit" className="space-y-3">
            <Label htmlFor={`${kind}-deposit`}>Amount (DOT)</Label>
            <div className="flex gap-2">
              <Input
                id={`${kind}-deposit`}
                type="text"
                inputMode="decimal"
                placeholder="0.0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                disabled={!canSubmit}
              />
              <Button
                disabled={!canSubmit || !depositAmount}
                onClick={() => vault.deposit(toPlanck(depositAmount), signer!).then(() => setDepositAmount(""))}
              >
                <ArrowDownToLine />
                Deposit
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="redeem" className="space-y-3">
            <Label htmlFor={`${kind}-redeem`}>Shares to redeem</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id={`${kind}-redeem`}
                type="text"
                inputMode="decimal"
                placeholder="0.0"
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
                disabled={!canSubmit}
                className="flex-1 min-w-32"
              />
              <Button
                variant="secondary"
                disabled={!canSubmit || !redeemAmount}
                onClick={() => vault.requestRedeem(toPlanck(redeemAmount), signer!).then(() => setRedeemAmount(""))}
              >
                <ArrowUpFromLine />
                Queue
              </Button>
              {vault.supportsInstantRedeem && (
                <Button
                  disabled={!canSubmit || !redeemAmount}
                  onClick={() => vault.redeemInstant(toPlanck(redeemAmount), signer!).then(() => setRedeemAmount(""))}
                >
                  Instant
                </Button>
              )}
            </div>

            {vault.redeemRequests.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead>Unlocks</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vault.redeemRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>{req.id}</TableCell>
                      <TableCell>{fromPlanck(req.shares)}</TableCell>
                      <TableCell>#{req.unlockAt.toString()}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={req.claimable ? "default" : "outline"}
                          disabled={!canSubmit || !req.claimable}
                          onClick={() => vault.claimRedeem(req.id, signer!)}
                        >
                          {req.claimable ? "Claim" : "Pending"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>

        {vault.error && <p className="text-sm text-destructive">{vault.error}</p>}
      </CardContent>
    </Card>
  );
}

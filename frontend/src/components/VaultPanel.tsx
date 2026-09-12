import type { ApiPromise } from "@polkadot/api";
import { BN } from "@polkadot/util";
import {
  ArrowUpFromLine,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useWallet } from "@/context/WalletProvider";
import { useBlockNumber } from "@/hooks/useBlockNumber";
import { useBridgeDeposit, type BridgeDepositStep } from "@/hooks/useBridgeDeposit";
import { useFreeBalance } from "@/hooks/useFreeBalance";
import { assetsFor, useVault, type VaultKind } from "@/hooks/useVault";
import { fromPlanck, toPlanck } from "@/lib/format";
import { tokenSymbol } from "@/lib/chain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  api: ApiPromise | null;
  kind: VaultKind;
  label: string;
}

const theme = {
  odot: {
    description: "Nomination-backed, no Hub slash",
    gradient: "from-[#00D2FF] to-[#22c1dc]",
    icon: ShieldCheck,
    badge: { text: "Unslashable", variant: "secondary" as const, icon: ShieldCheck },
  },
  edot: {
    description: "Validator self-stake, slash exposed",
    gradient: "from-[#7C3AED] to-[#a855f7]",
    icon: Zap,
    badge: { text: "Slashable", variant: "destructive" as const, icon: ShieldAlert },
  },
};

const PERCENTS = [25, 50, 75, 100];
const SYMBOL = tokenSymbol();

const DEPOSIT_STEPS: { key: BridgeDepositStep; label: string }[] = [
  { key: "awaiting-hub-signature", label: "Sign transfer on Hub" },
  { key: "awaiting-bridge-credit", label: "Waiting for Orbit to credit your deposit" },
  { key: "awaiting-orbit-deposit", label: "Sign deposit on Orbit" },
  { key: "done", label: "Deposited" },
];

function applyPercent(total: BN, pct: number): string {
  if (total.isZero()) return "0";
  const amount = total.muln(pct).divn(100);
  return fromPlanck(amount);
}

export function VaultPanel({ api, kind, label }: Props) {
  const { selected: account, signer, connect, connecting, walletError, hubApi } = useWallet();
  const vault = useVault(api, kind, account);
  const hubBalance = useFreeBalance(hubApi, account);
  const blockNumber = useBlockNumber(api);
  const bridgeDeposit = useBridgeDeposit({ hubApi, orbitApi: api, account, signer, vaultKind: kind });
  const [depositAmount, setDepositAmount] = useState("");
  const [redeemAmount, setRedeemAmount] = useState("");

  const heldAssets = assetsFor(vault.shares, vault.totalAssets, vault.totalShares);
  const rate = vault.totalShares.isZero()
    ? "-"
    : (Number(vault.totalAssets.toString()) / Number(vault.totalShares.toString())).toFixed(4);

  const unbondingPeriod = useMemo(() => {
    const consts = api?.consts[kind] as { unbondingPeriod?: { toNumber(): number } } | undefined;
    return consts?.unbondingPeriod?.toNumber() ?? 0;
  }, [api, kind]);

  const canSubmit = Boolean(api && account && signer && !vault.busy);
  const meta = theme[kind];
  const Icon = meta.icon;
  const BadgeIcon = meta.badge.icon;

  const depositStepIndex = DEPOSIT_STEPS.findIndex((s) => s.key === bridgeDeposit.step);
  const depositInProgress = bridgeDeposit.step !== "idle";

  return (
    <Card className="overflow-hidden py-0 gap-0">
      <div className={`h-1.5 bg-gradient-to-r ${meta.gradient}`} />
      <CardHeader className="pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex size-11 items-center justify-center rounded-full bg-gradient-to-br ${meta.gradient} text-white shadow-sm`}>
              <Icon className="size-5" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">{label}</p>
              <p className="text-xs text-muted-foreground">{meta.description}</p>
            </div>
          </div>
          <Badge variant={meta.badge.variant}>
            <BadgeIcon />
            {meta.badge.text}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pb-6 pt-5">
        <div className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/40 p-3 text-center">
          <div>
            <p className="text-[11px] text-muted-foreground">Your shares</p>
            <p className="font-semibold tabular-nums">{account ? fromPlanck(vault.shares) : "-"}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Redeemable</p>
            <p className="font-semibold tabular-nums">{account ? fromPlanck(heldAssets) : "-"}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Rate (V/S)</p>
            <p className="font-semibold tabular-nums">{rate}</p>
          </div>
        </div>

        {!account ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-8 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Wallet className="size-5" />
            </div>
            <p className="max-w-[220px] text-sm text-muted-foreground">
              Connect a wallet to deposit and manage {label}
            </p>
            <Button
              size="sm"
              disabled={connecting}
              onClick={connect}
              className={`bg-gradient-to-r ${meta.gradient} text-white hover:opacity-90`}
            >
              {connecting ? "Connecting..." : "Connect wallet"}
            </Button>
            {walletError && <p className="text-xs text-destructive">{walletError}</p>}
          </div>
        ) : (
          <Tabs defaultValue="deposit">
            <TabsList className="w-full">
              <TabsTrigger value="deposit">Deposit</TabsTrigger>
              <TabsTrigger value="redeem">Redeem</TabsTrigger>
            </TabsList>

            <TabsContent value="deposit" className="space-y-3">
              {depositInProgress ? (
                <div className="space-y-3 rounded-xl border p-4">
                  {bridgeDeposit.error ? (
                    <div className="flex items-start gap-2 text-sm text-destructive">
                      <XCircle className="mt-0.5 size-4 shrink-0" />
                      <p>{bridgeDeposit.error}</p>
                    </div>
                  ) : (
                    DEPOSIT_STEPS.map((s, i) => {
                      const isDone = i < depositStepIndex || bridgeDeposit.step === "done";
                      const isCurrent = i === depositStepIndex && bridgeDeposit.step !== "done";
                      return (
                        <div key={s.key} className="flex items-center gap-2 text-sm">
                          {isDone ? (
                            <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                          ) : isCurrent ? (
                            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                          ) : (
                            <Circle className="size-4 shrink-0 text-muted-foreground/40" />
                          )}
                          <span className={isCurrent ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
                        </div>
                      );
                    })
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const finished = bridgeDeposit.error !== null || bridgeDeposit.step === "done";
                      if (finished) {
                        bridgeDeposit.reset();
                        setDepositAmount("");
                      } else {
                        bridgeDeposit.cancel();
                      }
                    }}
                  >
                    {bridgeDeposit.error ? "Try again" : bridgeDeposit.step === "done" ? "Close" : "Cancel"}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Amount ({SYMBOL}, from your Hub balance)</span>
                    <span>Hub balance: {fromPlanck(hubBalance)}</span>
                  </div>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    disabled={!canSubmit}
                  />
                  <div className="flex gap-1.5">
                    {PERCENTS.map((pct) => (
                      <Button
                        key={pct}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={!canSubmit}
                        onClick={() => setDepositAmount(applyPercent(hubBalance, pct))}
                      >
                        {pct === 100 ? "Max" : `${pct}%`}
                      </Button>
                    ))}
                  </div>
                  <Button
                    className={`w-full bg-gradient-to-r ${meta.gradient} text-white hover:opacity-90`}
                    disabled={!canSubmit || !depositAmount}
                    onClick={() => bridgeDeposit.start(toPlanck(depositAmount))}
                  >
                    Deposit {label}
                  </Button>
                </>
              )}
            </TabsContent>

            <TabsContent value="redeem" className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Shares to redeem</span>
                <span>Held: {fromPlanck(vault.shares)}</span>
              </div>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.0"
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
                disabled={!canSubmit}
              />
              <div className="flex gap-1.5">
                {PERCENTS.map((pct) => (
                  <Button
                    key={pct}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={!canSubmit}
                    onClick={() => setRedeemAmount(applyPercent(vault.shares, pct))}
                  >
                    {pct === 100 ? "Max" : `${pct}%`}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={!canSubmit || !redeemAmount}
                  onClick={() => vault.requestRedeem(toPlanck(redeemAmount), signer!).then(() => setRedeemAmount(""))}
                >
                  <ArrowUpFromLine />
                  Queue
                </Button>
                {vault.supportsInstantRedeem && (
                  <Button
                    className={`flex-1 bg-gradient-to-r ${meta.gradient} text-white hover:opacity-90`}
                    disabled={!canSubmit || !redeemAmount}
                    onClick={() => vault.redeemInstant(toPlanck(redeemAmount), signer!).then(() => setRedeemAmount(""))}
                  >
                    Instant
                  </Button>
                )}
              </div>

              {vault.redeemRequests.length > 0 && (
                <div className="space-y-2 pt-1">
                  {vault.redeemRequests.map((req) => {
                    const elapsed =
                      blockNumber !== null && unbondingPeriod > 0
                        ? unbondingPeriod - Math.max(req.unlockAt.toNumber() - blockNumber, 0)
                        : 0;
                    const progress = unbondingPeriod > 0 ? Math.min(Math.max(elapsed / unbondingPeriod, 0), 1) * 100 : 0;
                    return (
                      <div key={req.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium tabular-nums">{fromPlanck(req.shares)} shares</span>
                          <Button
                            size="sm"
                            variant={req.claimable ? "default" : "outline"}
                            className={req.claimable ? `bg-gradient-to-r ${meta.gradient} text-white hover:opacity-90` : ""}
                            disabled={!canSubmit || !req.claimable}
                            onClick={() => vault.claimRedeem(req.id, signer!)}
                          >
                            {req.claimable ? "Claim" : "Pending"}
                          </Button>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${meta.gradient} transition-all`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="size-3" />#{req.unlockAt.toString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {vault.error && <p className="text-sm text-destructive">{vault.error}</p>}
      </CardContent>
    </Card>
  );
}

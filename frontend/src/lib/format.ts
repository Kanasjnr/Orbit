import type { ApiPromise } from "@polkadot/api";
import type { DispatchError } from "@polkadot/types/interfaces";
import { BN } from "@polkadot/util";

export const CHAIN_DECIMALS = 12;

export function toPlanck(amount: string, decimals = CHAIN_DECIMALS): BN {
  const [whole, frac = ""] = amount.trim().split(".");
  const paddedFrac = frac.slice(0, decimals).padEnd(decimals, "0");
  const base = new BN(10).pow(new BN(decimals));
  return new BN(whole || "0").mul(base).add(new BN(paddedFrac || "0"));
}

export function fromPlanck(amount: BN | bigint | number, decimals = CHAIN_DECIMALS): string {
  const value = new BN(amount.toString());
  const base = new BN(10).pow(new BN(decimals));
  const whole = value.div(base);
  const frac = value.mod(base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole.toString()}.${frac}` : whole.toString();
}

export function formatDispatchError(api: ApiPromise, error: DispatchError): string {
  if (error.isModule) {
    const decoded = api.registry.findMetaError(error.asModule);
    return `${decoded.section}.${decoded.name}`;
  }
  return error.toString();
}

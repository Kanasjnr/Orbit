import { ApiPromise, WsProvider } from "@polkadot/api";
import type { ApiOptions } from "@polkadot/api/types";

const DEFAULT_HUB_WS = "wss://asset-hub-paseo-rpc.n.dwellir.com";

export function hubWsEndpoint(): string {
  return import.meta.env.VITE_HUB_WS ?? DEFAULT_HUB_WS;
}

/** Orbit's designated Hub-side receiving account for bridge-in deposits. See WHITEPAPER.md section 11.6. */
export function bridgeReceivingAccount(): string {
  const account = import.meta.env.VITE_BRIDGE_RECEIVING_ACCOUNT;
  if (!account) throw new Error("VITE_BRIDGE_RECEIVING_ACCOUNT is not configured");
  return account;
}

// Asset Hub Paseo v2.5.2 decodes three Individuality extensions polkadot.js omits (None/None/false); drop after paseo-network/runtimes#434 ships.
export const HUB_SIGNED_EXTENSIONS = {
  AsPgas: { extrinsic: { asPgas: "Option<u8>" }, payload: {} },
  AsDotnsGateway: { extrinsic: { asDotnsGateway: "Option<u8>" }, payload: {} },
  RestrictOrigins: { extrinsic: { restrictOrigins: "bool" }, payload: {} },
} as unknown as NonNullable<ApiOptions["signedExtensions"]>;

let connection: Promise<ApiPromise> | null = null;

export function getHubApi(): Promise<ApiPromise> {
  if (!connection) {
    const provider = new WsProvider(hubWsEndpoint());
    connection = ApiPromise.create({ provider, signedExtensions: HUB_SIGNED_EXTENSIONS });
  }
  return connection;
}

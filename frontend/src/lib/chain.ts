import { ApiPromise, WsProvider } from "@polkadot/api";

const DEFAULT_WS = "ws://127.0.0.1:8845";

export function orbitWsEndpoint(): string {
  return import.meta.env.VITE_ORBIT_WS ?? DEFAULT_WS;
}

// Defaults assume the local Paseo collator (paseo/orbit.env.example). Point
// VITE_TOKEN_SYMBOL/VITE_NETWORK_NAME elsewhere for a Zombienet/other target.
export function tokenSymbol(): string {
  return import.meta.env.VITE_TOKEN_SYMBOL ?? "PAS";
}

export function networkName(): string {
  return import.meta.env.VITE_NETWORK_NAME ?? "Paseo Testnet";
}

let connection: Promise<ApiPromise> | null = null;

export function getApi(): Promise<ApiPromise> {
  if (!connection) {
    const provider = new WsProvider(orbitWsEndpoint());
    connection = ApiPromise.create({ provider });
  }
  return connection;
}

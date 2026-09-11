import { ApiPromise, WsProvider } from "@polkadot/api";

const DEFAULT_WS = "ws://127.0.0.1:8845";

export function orbitWsEndpoint(): string {
  return import.meta.env.VITE_ORBIT_WS ?? DEFAULT_WS;
}

let connection: Promise<ApiPromise> | null = null;

export function getApi(): Promise<ApiPromise> {
  if (!connection) {
    const provider = new WsProvider(orbitWsEndpoint());
    connection = ApiPromise.create({
      provider,
      runtime: {
        OrbitMixApi: [
          {
            methods: {
              mixMetrics: {
                description: "Live eDOT/oDOT vault mix metrics",
                params: [],
                type: "(u128, u128, Permill, u32)",
              },
            },
            version: 1,
          },
        ],
      },
    });
  }
  return connection;
}

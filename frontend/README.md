# Orbit frontend

Landing page plus a wallet-gated dashboard for the Orbit MVP: connect a wallet, bridge DOT/PAS in from Asset Hub, deposit into oDOT/eDOT, watch the rate, redeem. Talisman and SubWallet both work — they inject the same `injectedWeb3` interface.

```bash
npm install
cp .env.example .env   # fill in the values below
npm run dev
```

| Variable | Purpose |
|----------|---------|
| `VITE_ORBIT_WS` | Orbit collator WS endpoint. No default — point it at your local Zombienet/Paseo collator (e.g. `ws://127.0.0.1:8845`, matching `../paseo/orbit.env.example`'s `COLLATOR_RPC`). |
| `VITE_HUB_WS` | Asset Hub WS endpoint for the deposit bridge. Defaults to Paseo's Asset Hub (`wss://asset-hub-paseo-rpc.n.dwellir.com`). |
| `VITE_BRIDGE_RECEIVING_ACCOUNT` | Orbit's Hub-side receiving account for bridge-in deposits (§11.6 of the whitepaper). Required — deposits fail without it. |
| `VITE_TOKEN_SYMBOL` | Display symbol, defaults to `PAS`. |
| `VITE_NETWORK_NAME` | Display network name, defaults to `Paseo Testnet`. |

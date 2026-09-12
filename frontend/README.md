# Orbit frontend

Minimal UI for the Orbit MVP: connect a wallet, deposit into oDOT/eDOT, watch the rate, redeem. Talisman and SubWallet both work — they inject the same `injectedWeb3` interface.

```bash
npm install
cp .env.example .env   # point VITE_ORBIT_WS at your collator
npm run dev
```

`VITE_ORBIT_WS` defaults to `ws://127.0.0.1:8845`, matching the local Paseo collator RPC port in `../paseo/orbit.env.example`. Point it at a Zombienet collator's WS port instead for the local lab.

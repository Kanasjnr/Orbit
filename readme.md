# Orbit

Liquid staking for Polkadot after the June 2026 reward split: **oDOT** (nomination, no Hub slash) and **eDOT** (validator self-stake incentive, Hub-slashable). Operators run nodes via `StakingOperator`; they cannot move funds. In v1, stash keys sit under Orbit multisig that is the custody boundary, not end-user self-custody of the stash.

Status: specification + legacy experiment. **Not audited. Not mainnet. Do not deposit real DOT.**

---

## What we are building


| Token    | Path                                                    | Hub slash                                                     | Yield                                                 |
| -------- | ------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| **oDOT** | Pooled nomination behind Orbit validator slots          | No (nominator rules). Custody/ops failure is a separate risk. | Base staking yield + DeFi use                         |
| **eDOT** | Bonded as validator self-stake (`σ`); pros run the node | Yes — hits eDOT only                                          | Base on `σ` + self-stake incentive pot (22.6% of DAP) |


Orbit does **not** wait on JAM. It does **not** launch a day-one governance token. It does **not** treat Solidity/Revive contracts as the MVP unlock — Hub staking (`nominate` / `bond` / `StakingOperator`) is the unlock.

**Next code (MVP):** a local **Zombienet** FRAME parachain runtime with dual oDOT/eDOT pallets, wired to Hub-shaped staking (Chopsticks). See whitepaper §11 and §17.

---



## This repo today


| Path            | What it is                                 | Role                                                                     |
| --------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `WHITEPAPER.md` | Protocol + economics spec                  | Source of truth                                                          |
| `contract/`     | Hardhat + Solidity `ODOT` / `StakingVault` | **Legacy** single-vault experiment. MVP does **not** continue this path. |
| `frontend/`     | React PoC scaffolding for that vault       | Legacy UI                                                                |


The Solidity vault simulates APR, restaking locks, and a single oDOT. That is **not** the dual-vault Hub product (separate oDOT/eDOT, no EigenLayer-style restaking as the thesis, Hub slash ≠ vault `slash()`).

---



## Legacy Solidity PoC (do not treat as product)

Only if you need to run the old contracts:

```bash
cd contract
npm install
npx hardhat test
```

Deploy (Asset Hub EVM testnet, simulated vault not Hub NPoS):

```bash
npx hardhat vars set PRIVATE_KEY "0xYOUR_PRIVATE_KEY"
npx hardhat run scripts/deploy.ts --network polkadotHubTestnet
```

RPC used by that Hardhat config: `https://testnet-passet-hub-eth-rpc.polkadot.io`

---



## Disclosures

- Code in this repo is **unaudited**.
- v1 production custody is **multisig stash +** `StakingOperator`, not “users keep the stash.”
- Hub slash, if it happens, is modeled as hitting **eDOT only**; oDOT is not a slash waterfall. Theft or buggy accounting can still impair either vault.
- Economic figures in the whitepaper (including any ~73% anecdote) are not promised APYs.

Full list: whitepaper §16.
# Orbit

Liquid staking for Polkadot after the June 2026 reward split: **oDOT** (nomination, no Hub slash) and **eDOT** (validator self-stake incentive, Hub-slashable). Operators run nodes via `StakingOperator`; they cannot move funds. In v1, stash keys sit under Orbit multisig — that is the custody boundary, not end-user self-custody of the stash.

**Spec:** [WHITEPAPER.md](./WHITEPAPER.md). If this README and the whitepaper disagree, the whitepaper wins.

Status: specification only. **Not audited. Not mainnet. Do not deposit real DOT.**

MVP code lands in follow-up PRs (FRAME parachain → oDOT pallet → Hub shapes → eDOT → Zombienet). See whitepaper §17.

---

## This repo today

| Path | What it is |
| ---- | ---------- |
| `WHITEPAPER.md` | Protocol + economics spec (source of truth) |

The legacy Solidity vault (`contract/`) and EVM frontend are removed. They were a single-vault experiment and are not the Hub dual-vault product.

---

## Disclosures

Code is unaudited until a production audit lands. v1 production custody is **multisig stash + `StakingOperator`**, not “users keep the stash.” Hub slash hits **eDOT only**; oDOT is not a slash waterfall. Theft or buggy accounting can still impair either vault. Economic figures in the whitepaper (including any ~73% anecdote) are not promised APYs.

Full list: whitepaper §16.

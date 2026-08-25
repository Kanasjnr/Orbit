# Orbit Protocol Whitepaper

**Liquid Staking for Polkadot with a Separate Path for Validator Self-Stake Yield**

Version 1.0 · Technical & Economic Specification · August 2026

> In June 2026 Polkadot split staking rewards into two buckets: ordinary nomination (low yield, no slashing for nominators) and validator self-stake (higher yield, slashable). Orbit lets you deposit DOT, get liquid **oDOT** for the safe nomination path or **eDOT** for the self-stake incentive path, and use either token in DeFi. Professional operators run the nodes via `StakingOperator` (they cannot move funds). Stash keys sit under Orbit multisig in v1 — that is the custody boundary, not full end-user self-custody of the stash.

---



## Table of Contents

1. The Pitch
2. Why Now
3. Where Orbit Plugs In
4. Executive Summary
5. The Post-Reform Reward Structure
6. The Self-Stake Incentive Curve: Mathematics
7. Optimal Capital Allocation
8. Token Design & Naming
9. Share Accounting & Exchange-Rate Mathematics
10. Risk Model: Slashing, Coverage
11. Protocol Architecture & Trust Model
12. Liquidity, Peg & Redemption Mathematics
13. Economic Model: Fees, Revenue, Break-Even
14. How People Use Orbit
15. Competitive Landscape
16. Risk Disclosures
17. MVP: What We Build First
18. Roadmap
19. How Orbit Plugs Into JAM
20. Sources

---



## 1. The Pitch

Orbit turns DOT into liquid stake safe (**oDOT**) or self-stake yield (**eDOT**) without you running a validator.

**The problem.** After June 2026, Polkadot pays two different staking yields:

1. **Nomination** — lower yield, nominators are unslashable, easy for anyone.
2. **Validator self-stake** — higher yield from a fixed incentive pot, slashable, normally needs a node (or trusting an operator with keys).

Existing liquid staking products mostly wrap (1). Almost nobody packages (2) as a liquid token for retail.

**What Orbit does.** You deposit DOT and choose:


| Token    | Path                                                                                  | Slash risk           | What you get                                       |
| -------- | ------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------- |
| **oDOT** | Orbit nominates validators for you                                                    | No Hub slash*        | Liquid receipt + base staking yield + DeFi use     |
| **eDOT** | Orbit bonds your DOT as validator self-stake; pros run the node via `StakingOperator` | Yes                  | Liquid receipt + base yield + self-stake incentive |


*Hub nominator rules: oDOT is not cut by validator slash. Custody/ops failure is a separate risk (Sections 10.1, 11) — not the same as slash.

**How it works under the hood (one sentence).** Orbit runs many small validator slots (~10,000 DOT self-stake each), uses oDOT capital to nominate those same slots so they get elected, and keeps stash keys under Orbit multisig while operators only get node rights via `StakingOperator` — depositors do not hold stash keys.

**What we are not selling.** Unlocking a 28-day lockup (that is already gone). Cloning Bifrost. Waiting for JAM (Orbit ships on today’s Hub staking; JAM is a later hook — Section 19). A day-one governance token.

---



## 2. Why Now

Six changes, all landing within the eleven months before this document, together make this the first moment this protocol could exist at all and the first moment it would be worth building.

**1. The yield split is brand new.** A June 29, 2026 protocol parameter update rewrote how staking rewards are distributed: 45.2% of the Dynamic Allocation Pool (DAP) budget now goes to ordinary staker (nominator) rewards, 22.6% goes to a new validator self-stake incentive, and validator commission was forced to 0%. Before this, validators earned through commission on nominator rewards; after it, they earn through a separate pot that rewards their own locked capital. This is roughly eight weeks old at time of writing — the market has not yet repriced around it.

**2. Nominator yield has quietly collapsed.** Community reporting since the reform shows nominator real yield sitting around 3%, down roughly 70% from pre-reform levels, even though headline APY displays (~6%) look largely unchanged. Section 5.4 works out exactly why those two numbers diverge — the gap comes from real yield vs. nominal APY measuring different things, and that gap widened sharply. Most retail nominators do not yet know their real return has fallen this far.

**3. Validator self-stake yield has simultaneously surged.** The same reporting shows a validator with the new 10,000 DOT minimum self-stake bonded going from roughly 23 DOT/day to roughly 43 DOT/day after the reform — an ~85% increase in per-validator reward. That premium is currently accessible only to people who can run a validator node.

**4. An operator-delegation path to that premium didn't exist until March 2026.** The StakingOperator proxy, introduced in runtime 2.1.0, is the first Polkadot primitive that lets a *solo* capital holder keep custody of their stash while a separate, removable operator key runs the validator node. Before this proxy existed, capturing self-stake yield required either running your own infrastructure or handing the stash to the node runner. A pooled self-stake product with removable operators was not previously buildable — but pooled stashes still need a custody layer. Orbit v1 holds those stashes under protocol multisig (§11); `StakingOperator` does not make the product end-user self-custodial.

**5. Asset Hub consolidation just finished.** On November 4, 2025, staking, balances, and governance state all moved onto Polkadot Asset Hub, with a 100x lower existential deposit. Orbit’s product sits on top of that Hub staking surface — nominate, bond, `StakingOperator` — regardless of whether vault accounting is a FRAME parachain runtime (MVP) or a thinner Hub-adjacent layer later. Co-located staking state is the unlock; Solidity/Revive contracts are optional later, not what makes this buildable now.

**6. Redemption got structurally cheaper.** Nominator unbonding fell from 28 days to roughly 24–48 hours. Every liquid staking design lives or dies on how expensive it is to maintain a redemption buffer against a slow unbonding queue; a queue that's gone from a month to under two days makes tight-peg liquid tokens dramatically cheaper to run than they were under the old regime (Section 12.1 derives exactly how much cheaper).

None of the existing Polkadot liquid staking tokens (Bifrost's vDOT, Acala's LDOT, Equilibrium's xDOT, and others) were built for this split. They pool nomination only and don't offer a separate liquid token for validator self-stake incentive. The gap is open because the reform is only a few months old.

**Summary of the six changes:**


| #   | Change                           | Date                 | Magnitude                                             |
| --- | -------------------------------- | -------------------- | ----------------------------------------------------- |
| 1   | Reward-split reform              | 2026-06-29           | 22.6% of DAP redirected to a new self-stake incentive |
| 2   | Nominator real yield collapse    | ongoing since reform | ~6% nominal → ~3% real (decomposed in Section 5.4)    |
| 3   | Validator self-stake yield surge | ongoing since reform | ~23 → ~43 DOT/day per validator (+85%)                |
| 4   | StakingOperator proxy            | 2026-03-12           | First revocable operator-delegation primitive (stash stays with the capital holder) |
| 5   | Asset Hub consolidation          | 2025-11-04           | Staking on Hub; 100x lower existential deposit        |
| 6   | Unbonding period cut             | with the reform      | 28 days → ~24–48 hours (a 14–28x reduction)           |


---



## 3. Where Orbit Plugs In

Orbit does not replace Polkadot staking. It sits **on top of** Hub staking and **beside** DeFi apps. This is the map.

**Read as target design.** Sections 3–13 describe the intended production system (Hub staking calls, multisig stashes, dual vaults). Near-term build is a Zombienet/Chopsticks PoC (§11, §17) — no mainnet custody yet. Confident present tense below means "this is how Orbit is meant to work," not "this is already live."

### 3.1 Stack diagram

```
┌──────────────────────────────────────────────────────────────┐
│  YOU                                                         │
│  Wallet (Talisman / SubWallet) · Orbit web app               │
└────────────────────────────┬─────────────────────────────────┘
                             │ deposit / redeem / swap
┌────────────────────────────▼─────────────────────────────────┐
│  ORBIT LAYER  (this protocol)                                │
│  · oDOT vault  → share math, nominate                        │
│  · eDOT vault  → share math, self-stake + slash accounting   │
│  · Operator registry · redemption buffer · fees              │
└───────┬───────────────────────────────┬──────────────────────┘
        │ nominate / bond / proxy       │ XCM / list token
        ▼                               ▼
┌───────────────────────┐    ┌─────────────────────────────────┐
│  POLKADOT HUB         │    │  DEFI (partners, in order)      │
│  (Asset Hub)          │    │  1. Hydration peg / Omnipool    │
│  · balances (DOT)     │    │  2. Acala / HOLLAR collateral   │
│  · staking pallet     │    │  3. Broader EVM (later)         │
│  · StakingOperator    │    └─────────────────────────────────┘
└───────────┬───────────┘
            │ consensus / security
┌───────────▼───────────┐
│  RELAY / (later) JAM  │
│  validators · finality│
│  Orbit does not wait  │
│  on JAM to ship   see │
│  Section 19           │
└───────────────────────┘

```



### 3.2 Plug-in points (what Orbit actually calls)


| Plug-in                            | Who owns it                                                                          | Orbit's job                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **DOT balances**                   | Hub                                                                                  | Accept deposits; later pay redemptions                               |
| **Staking / nomination**           | Hub staking                                                                          | Route **oDOT** pool as nominator stake behind Orbit validators       |
| **Validator self-stake**           | Hub staking                                                                          | Bond **eDOT** pool as `σ` on Orbit stashes (≥ 10,000 DOT)            |
| `StakingOperator` **proxy**        | Hub                                                                                  | Give node runners ops rights; they never move funds                  |
| **Share tokens oDOT / eDOT**       | Orbit runtime (FRAME pallets on Zombienet PoC; production path TBD Hub vs parachain) | Mint/burn, exchange rate, fees                                       |
| **Hydration → Acala/HOLLAR → EVM** | Partners                                                                             | Peg first, then borrow/stable loops, then broader EVM composability  |
| **Relay / JAM**                    | Polkadot                                                                             | Security today; later rebind to JAM staking Service + optional deposits (Section 19) |




### 3.3 Where the math plugs in


| Math in this paper                               | What it decides                       | Which plug-in                  |
| ------------------------------------------------ | ------------------------------------- | ------------------------------ |
| DAP split / `y_base` / `y_incentive` (Section 5) | How much each path earns              | Hub staking rewards            |
| Weight `w(σ)=√σ`, maximize `k` (Section 6)       | How to size and count validator slots | eDOT bonding                   |
| `T_min`, `ν*` (Sections 6–7)                     | How much nomination each slot needs   | oDOT nomination                |
| `rate_T = V/S` (Section 9)                       | How many tokens you get / redeem      | Orbit vaults                   |
| Hub slash vs custody / `φ` (Section 10)          | Who takes Hub slash vs ops failure    | Hub slash: eDOT only; oDOT unaffected — custody is a separate threat (§10.1) |
| `δ*`, buffer (Section 12)                        | Instant exit vs wait                  | Hub unbonding + Hydration      |
| Fees (Section 13)                                | Protocol revenue                      | Orbit vaults                   |


If a formula feels abstract, use this table: every equation is either pricing a Hub staking cash flow or sizing an Orbit vault/slot.

---



## 4. Executive Summary

Orbit pools DOT into two staking paths and mints one liquid token for each:


| Token    | What it is                                                                                     | Slashable?                                  | Yield                                                                        |
| -------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------- |
| **oDOT** | Nominated stake — Orbit picks validators, you hold a receipt                                   | No Hub slash*                               | Base network staking rewards (~3% real; moves with params)                   |
| **eDOT** | Validator self-stake — your DOT is the validator's bonded skin; a node operator runs the machine | Yes (Hub self-stake)                        | Base rewards + self-stake incentive (22.6% of DAP, shared across validators) |


*Same as Section 1: no Hub slash on oDOT; custody/ops risk is separate (Sections 10–11).

See Section 8 for naming. If a validator gets slashed on Hub, **eDOT** takes the hit — nominator-backed **oDOT** is unslashable under post-reform rules (Section 10). Custody failure is a separate threat from slash (Section 11).

Orbit's job on the protocol side (Sections 6–7): run many validator slots at ~10,000 DOT self-stake each, nominate them with oDOT capital so they actually get elected, and delegate node ops via `StakingOperator`. That's not something most retail stakers will do manually.

**Quick reference — key derived quantities** (illustrative; recompute against live chain state before relying on any of them):

```
σ*            optimal self-stake per slot     =  10,000 DOT         (Section 7)
φ_target      slashable share at target mix   ≈  0.69% of TVL       (Section 10.2; design target, not guaranteed)
δ*            calm no-arb instant-redeem cap  ≈  0.016%             (Section 12.1; not a bank-run peg guarantee)
y_incentive   pot structure (lead with this)  =  share of 22.6% DAP / competing self-stake
              one forum calibration only      ≈  ~73% on 10k σ      (Section 5.3 — anecdote, not a forecast)
```

---



## 5. The Post-Reform Reward Structure



### 5.1 Verified parameters


| Parameter                                  | Value                                                     | Source                              |
| ------------------------------------------ | --------------------------------------------------------- | ----------------------------------- |
| DAP split — staker rewards                 | 45.2%                                                     | Referendum 1909                     |
| DAP split — validator self-stake incentive | 22.6%                                                     | Referendum 1909                     |
| DAP split — buffer/reserve                 | 32.2%                                                     | Referendum 1909                     |
| Validator commission                       | Forced to 0% (MaxCommission = 0)                          | Referendum 1909                     |
| Minimum validator self-stake               | 10,000 DOT, slashable                                     | Referendum 1909 (and prior staking param updates) |
| Nominator slashing status                  | Unslashable                                               | Referendum 1909                     |
| Unbonding period                           | ~24–48 hours (down from 28 days)                          | Referendum 1909                     |
| Active validator set size                  | ~600                                                      | Live network state                  |
| Total DOT staked                           | ~883M DOT (~50–52% of supply; supply estimates vary)      | Live network state                  |
| Post-halving annual issuance / inflation   | ~55M DOT/year, ~3.1%                                      | March 2026 halving                  |
| StakingOperator proxy                      | Introduced runtime 2.1.0, non-custodial, staker-revocable | Runtime upgrade, March 12, 2026     |


These figures — especially total staked DOT, validator count, and the exact incentive-pot size — are live network state and will have moved by the time you read this. Treat every number in this document as a point-in-time snapshot to re-measure at deployment, not a constant.

The DAP's **32.2% buffer/reserve** bucket is network-level issuance held outside the staker-reward and self-stake-incentive streams (Referendum 1909). Orbit does not claim that bucket as protocol revenue; oDOT/eDOT economics in this paper use only the 45.2% staker and 22.6% incentive shares. If governance later redirects reserve into staking, recompute yields — do not silently assume today's split is permanent (see §16).

### 5.2 What "unslashable nominator, slashable self-stake" actually means

Before the reform, both nominator and validator stake shared exposure to slashing for equivocation and unresponsiveness. After the reform, slashing risk sits only on validator self-stake. Orbit mirrors that split with oDOT and eDOT instead of blending everything into one token (Section 8).

### 5.3 A real, sourced data point

Read the incentive layer as pot structure, not a headline APR. It is 22.6% of the DAP, shared across active validators’ self-stake via the (concave) weight function. A rough order-of-magnitude check is: annual incentive budget ÷ aggregate competing self-stake — recompute from live issuance and set size before quoting any rate.

Community-reported figures (Polkadot Forum, self-reported, not independently audited) put one validator at ~23 DOT/day pre-reform and ~43 DOT/day post-reform at exactly the 10,000 DOT minimum — about ~7,300 DOT/year incremental on that self-stake alone:

```
7,300 DOT/year / 10,000 DOT  =  0.73  =  73%   (one reported calibration only)
```

That **~73%** is a single operator anecdote used later only to size illustrative worked examples. It is **not** a network average, a forecast, or a v1 promised yield. Prefer pot-structure math at deployment.

### 5.4 Why headline APY and real yield diverge

Wallets typically display a nominal staking APY computed as (annual DOT rewards paid) / (DOT staked) community reporting puts this around 6% post-reform (§2, point 2). But DOT's total supply is also inflating, at roughly 3.1% per year following the March 2026 halving (annual issuance fell from ~120M to ~55M DOT, per §5.1). A staker's real return is not the nominal reward rate itself — it's how fast their share of total supply grows, because a non-staking holder's share shrinks by exactly the inflation rate every year, while a staker's DOT balance grows by the nominal reward rate.

If y_nom is the nominal reward rate and π is the network-wide inflation rate, a staker's share of total supply grows at:

```
(1 + y_nom) / (1 + π)  −  1   ≈   y_nom − π        (for small y_nom, π)
```

Plugging in y_nom ≈ 6% and π ≈ 3.1%:

```
real yield  ≈  6.0%  −  3.1%  ≈  2.9%
```

This is the ~3% real yield figure used throughout this document. It is not an independently-sourced number — it is the direct arithmetic consequence of the nominal reward rate and the post-halving inflation rate. It is also *why* a headline APY that looks roughly unchanged from before the reform can coexist with a real return that collapsed: the number the reform changed is the numerator paid to nominators, and the gap retail stakers actually feel is between that nominal number and the inflation rate they're implicitly being compared against — a gap that widened sharply once the nominal rate fell while inflation stayed roughly where it was.

---



## 6. The Self-Stake Incentive Curve: Mathematics



### 6.0 Notation


| Symbol          | Meaning                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| σ_i             | Validator i's self-stake (slashable, ≥ 10,000 DOT)                                                                                |
| ν_i             | Stake nominated to validator i (unslashable)                                                                                      |
| T_i = σ_i + ν_i | Validator i's total backing stake                                                                                                 |
| T_min           | The minimum total backing needed to be the marginal elected validator (live network state)                                        |
| N               | Size of the active validator set (~600)                                                                                           |
| w(σ)            | The (unpublished, modeled) weight function mapping self-stake to incentive-budget share                                           |
| p               | Curvature parameter of the modeled weight function w(σ) = σ^p, p ∈ (0,1); p = 1/2 is the square-root case used for worked numbers |
| B               | The self-stake incentive budget for one era/year (22.6% of the DAP)                                                               |
| y_base          | Base staker-reward yield, paid on total backing T_i (~3% real, §5.4)                                                              |
| y_incentive     | Incremental yield paid on self-stake σ_i alone, from B                                                                            |
| C               | Total capital Orbit allocates to the eDOT (self-stake) strategy                                                                   |
| k               | Number of independently-elected validator slots Orbit operates                                                                    |
| V_T, S_T        | Backing pool value and outstanding share supply of token T ∈ {oDOT, eDOT}                                                         |
| φ               | Live protocol-wide slashable fraction of TVL, φ = Σ_i σ_i / Σ_i T_i                                                               |
| φ_target        | φ at target oDOT/eDOT mix (~0.69% at illustrative T_min; §7.3, §10.2) — design target, not guaranteed                             |
| φ_TVL           | Live eDOT share of protocol TVL, V_eDOT/(V_oDOT+V_eDOT); fee blend (§13.3); equals φ only at target mix                            |


Every formula from here through Section 13 is stated in these terms, so each derivation can be checked independently of the surrounding prose.

**How to read this section.** Each formula has three parts: (1) symbols, (2) the equation, (3) a **What this means** note that says what Orbit does with it. If you only care about product, skim the “what this means” blocks and Section 3's plug-in table.

### 6.1 The weight function

Referendum 1909 specifies that the self-stake incentive budget is distributed "proportionally to a weight derived from each validator's self-stake" using a function chosen to be concave, explicitly to stop large self-stakers from capturing a disproportionate share. The exact functional form has not been published in full technical detail as of this writing. We model it, as the reform's own stated design goal implies, with a square-root weight — a standard, well-behaved concave function and the natural minimal choice for "reward self-stake, but with diminishing returns":

```
w(σ_i)  =  √σ_i

incentive_i  =  B · √σ_i / Σ_j √σ_j      (sum over all j = 1..N active validators)
```

This is a modeled approximation, not a confirmed on-chain formula. Every downstream calculation in this section should be read as "if the weight function is concave in this standard way" directionally reliable, not precise to the DOT. The protocol's engineering team should re-derive the exact function from runtime source at implementation time.

**What this means.** The network has a fixed pot of incentive DOT each era (`B`). Each validator gets a slice based on how much they bonded themselves (`σ`). Because of the square root, bonding *twice* as much does *not* get you twice the slice so ten validators with 10k each earn more *combined weight* than one with 100k. **What Orbit does here:** run many 10k slots (eDOT) instead of one whale bond.

### 6.2 Why concavity implies "many small stakes beat one large one"

Two separate facts are needed here, and it matters to keep them separate: (a) for a *fixed* number of slots k, is it better to split capital evenly or unevenly across them, and (b) is it better to use *more* slots at all. Both point the same direction, but they are proven differently, and conflating them is an easy way to get the direction of an inequality backwards.

**(a) Even splitting beats uneven splitting, for a fixed k.** Jensen's inequality for a concave function states that the function evaluated at a mean is at least as large as the mean of the function's values:

```
w( mean(σ_1, ..., σ_k) )   ≥   mean( w(σ_1), ..., w(σ_k) )
```

Multiplying both sides by k, and using σ_1 + ... + σ_k = C (the split sums to total capital C):

```
k · w(C/k)   ≥   Σ_i w(σ_i)          for ANY split σ_1, ..., σ_k summing to C
```

with equality exactly when the split is even (σ_i = C/k for every i) — a direct consequence of w's strict concavity. So k·w(C/k) is the maximum total weight achievable across k slots, and it is achieved by splitting evenly, never by splitting unevenly. This proves: don't concentrate stake unevenly across the slots you already have — spread it evenly across them.

**(b) More slots beats fewer slots, for the same total capital.** This is a different claim — not about how to split among a fixed k, but about whether increasing k helps at all. Take the general power-law form w(σ) = σ^p for p ∈ (0,1); p = 1/2 recovers the square-root case in §6.1, and every member of this family is strictly concave and increasing. Per the reform's own stated anti-capture design goal, the true function belongs to this family regardless of its exact p (§6.5 checks sensitivity to p directly). With even splitting (from part (a) above), total weight as a function of k is:

```
W(k)  =  k · w(C/k)  =  k · (C/k)^p  =  C^p · k^(1−p)
```

Since p ∈ (0,1), the exponent (1−p) is strictly positive, so W(k) is strictly increasing in k for every member of this family, not just p = 1/2. Doubling k multiplies total weight by 2^(1−p); at p = 1/2 that's 2^0.5 ≈ 1.41×, the figure used in the rest of this document.

Together, (a) and (b) give the full recommendation: split self-stake capital evenly across as many independently-elected validator slots as the election constraint (Section 6.3) allows.

**What this means.** (a) Don't put uneven amounts on the slots you already run equal is best. (b) Opening *another* min-sized slot beats dumping more DOT into an existing one. **Orbit's allocator** (Section 7) is just that rule in code: grow `k`, keep each `σ` near 10,000.

### 6.3 The binding constraint: election, not the incentive formula

Self-stake weight only pays out if the validator is actually elected into the active set. Election is decided by the network's stake-weighted election mechanism (Phragmén-style) over total backing self-stake plus nominated stake not self-stake alone. With ~883M DOT staked across ~600 slots, average backing per slot is roughly:

```
T̄  =  883,000,000 / 600  ≈  1,470,000 DOT   (≈ 1.47M DOT)
```

The actual threshold to be the marginal elected validator (the cheapest slot to win) is typically below this mean, since backing is not evenly distributed but the precise current threshold is live state that must be measured at deployment, not assumed. Call it T_min.

Each new slot needs enough **total** backing (self-stake + nomination) to win election — not just 10,000 DOT of bond. **oDOT** deposits supply that nomination side; **eDOT** supplies the bond. The two tokens work together: eDOT can't earn if its validators aren't elected, and oDOT nominates Orbit's own validators instead of random names on the leaderboard.

For worked examples below we pick an **illustrative** clearing threshold `T_min ≈ 1,440,000 DOT` — slightly below the ~1.47M average, as marginal elected validators typically sit under the mean. This is a modeling choice to re-measure at deployment, not a figure read off-chain.

### 6.4 Combined per-slot yield, worked example

Take a single Orbit-controlled validator slot with:

- Self-stake σ = 10,000 DOT (the minimum)
- Total backing T = T_min ≈ 1,440,000 DOT (illustrative clearing threshold from §6.3)
- Nominated backing ν* = T_min − σ ≈ 1,430,000 DOT (matches §7.0)
- Base staker yield y_base ≈ 3% (§5.4)

The slot earns base yield on its full backing (σ + ν), plus the self-stake incentive share on σ alone. Using the **anecdotal** calibration from §5.3 (~7,300 DOT/year on a 10,000 DOT self-stake ≈ ~73% on self-stake only — one reported data point, not a forecast):

```
total slot yield  =  (σ + ν) · y_base   +   σ · y_incentive

                  ≈  1,440,000 × 0.03   +   10,000 × 0.73

                  ≈  43,200              +   7,300

                  ≈  50,500 DOT/yr
```

Blended across the full σ + ν = 1,440,000 DOT (1.44M DOT) backing that slot represents, this is a blended APR of:

```
50,500 / 1,440,000  ≈  3.50%
```

The self-stake slice is where the incentive pot concentrates (forum calibration ~73% on that 10k — anecdote only, §5.3), which is why Orbit issues **eDOT** separately instead of blending everything into one token at ~3.5% (Section 8.4).

**Reading the 50,500 DOT/yr example.**

- `1,440,000 × 3%` ≈ 43,200 → everyone behind the slot (mostly nominators / oDOT) shares this base yield.
- `10,000 × 73%` ≈ 7,300 → only the self-stake (eDOT) earns this extra pot.
- Blended `50,500 / 1,440,000` ≈ 3.5% → if you *merged* both into one token, the juicy 73% gets watered down to almost nothing.
**What Orbit does:** oDOT gets base yield on ν; eDOT gets base yield on σ plus the 7,300-style incentive stream (illustrative numbers — remeasure live).



### 6.5 Sensitivity to the unknown exponent

Because p is not publicly confirmed, it's worth checking how much the §6.4 conclusion moves if the true weight function is more or less concave than the p = 1/2 working assumption. Here is how the *shape* of the splitting benefit not its calibrated level changes under other plausible values of p, holding per-slot self-stake at 10,000 DOT:


| p (concavity)            | Weight ratio, doubling k | Qualitative reading                                                                |
| ------------------------ | ------------------------ | ---------------------------------------------------------------------------------- |
| 0.3 (highly concave)     | 2^0.7 ≈ 1.62×            | Splitting matters even more; incentive strongly favors many tiny slots             |
| 0.5 (assumed / sqrt)     | 2^0.5 ≈ 1.41×            | Baseline used throughout this document                                             |
| 0.7 (mildly concave)     | 2^0.3 ≈ 1.23×            | Splitting still strictly better, but with a flatter payoff                         |
| 1.0 (linear — ruled out) | 1.00×                    | No splitting benefit; excluded by the reform's own stated anti-capture design goal |


Across the entire plausible range the reform's stated goal permits (p < 1), the qualitative recommendation from §7 — maximize slot count k at minimum viable self-stake — holds regardless of exactly where p sits. Only the *magnitude* of the multi-slot splitting benefit (§6.2) and the *shape* of equilibrium compression (§13.5) are sensitive to p.

The forum ~73% calibration (§5.3) does **not** inherit p — it is an empirical anecdote, independent of the weight-function exponent. What *does* inherit p = 0.5 as a modeling assumption: splitting ratios in §6.2 and Scenario B compression in §13.5. Re-derive those from runtime `w(σ)` before mainnet claims; do not treat 73% as model-output.

---



## 7. Optimal Capital Allocation

oDOT and eDOT are separate vaults with separate depositors — capital is **not** one fungible pool `C` the protocol can freely re-split. The math below is the *target slot recipe* once both pools can fund a slot: how to size `σ` (from eDOT) and `ν` (from oDOT). Live minting must respect deposit mix (Section 7.3).

Given available eDOT capital C_e and oDOT capital C_o, the allocator’s problem for openable slots is:

```
maximize over k, σ, ν:

    k · [ (σ + ν)·y_base   +   σ^p · B / Σ_j σ_j^p ]

subject to:

    k · σ        ≤  C_e         (eDOT / self-stake capital)
    k · ν        ≤  C_o         (oDOT / nomination capital)
    σ + ν        ≥  T_min       (election constraint)
    σ             ≥  10,000     (protocol floor)
```

If either pool is short, `k` is capped by `min(⌊C_e/σ⌋, ⌊C_o/ν⌋)`, not by total TVL.

### 7.0 Formal derivation

Treat σ and ν as continuous and relax k to a positive real (valid since N is large and Orbit's k ≪ N). The per-slot objective is:

```
g(σ, ν)  =  (σ + ν)·y_base   +   σ^p · B / Σ_j σ_j^p
```

Two structural facts pin down the solution without an interior first-order condition:

**On σ:** the stated objective `g` is pure expected yield — it has **no risk term**. Holding a *single* slot's total backing fixed, raising σ would actually raise incentive weight. The floor solution does **not** come from that single-slot FOC.

The binding argument is the **cross-slot** one from §6.2: under concave `w`, the marginal DOT of eDOT capital earns more total weight as the *first* 10,000 on a new elected slot than as incremental self-stake on an already-min-sized slot. Combined with the election floor σ ≥ 10,000, the allocator's corner is σ* = 10,000 — maximize `k`, don't fatten existing bonds. Slash risk (§10) is a *separate* reason the same corner is attractive; it is not inside the §7 objective as written.

**On ν:** ν enters g only through the linear base-yield term (σ+ν)·y_base — it has no effect on the incentive share at all. Its sole function is satisfying the election constraint σ+ν ≥ T_min. Since ν is costly (it is capital that could instead back a different slot) and contributes nothing beyond clearing that constraint, the optimum is exactly ν* = T_min − σ — a second corner solution, this time at the *lower* bound of the constraint rather than an unconstrained interior point.

**On k:** substituting both corner solutions back in, each slot costs exactly T_min of capital and contributes weight σ^p = 10,000^p, a constant independent of k. Total incentive-budget weight is therefore k·10,000^p — linear and strictly increasing in k while total base yield on funded slots is k·T_min·y_base, independent of how that capital is labeled across vaults. Increasing k (subject to both vaults funding σ* and ν*) therefore strictly increases total incentive revenue while leaving base revenue unchanged, so k should be maximized — formalizing, via the objective's own structure, the same conclusion reached by direct substitution in §6.2.

**Resulting solution (per openable slot):**

```
σ*  =  10,000                         protocol floor — corner solution, not a calculus optimum
ν*  =  T_min − σ*                     exactly enough to clear election, no more
k*  =  min( ⌊C_e / σ*⌋, ⌊C_o / ν*⌋ )  limited by the scarcer vault
```

So the resolved strategy is: run as many validator slots as **both** vaults allow, each at minimum viable self-stake and minimum viable nomination to clear election. This matches the risk-minimizing posture in Section 10 when the target mix is achieved — the two objectives point the same direction.

**What this means.**

- `σ* = 10,000` → bond the minimum self-stake (eDOT capital).
- `ν* = T_min − σ*` → nominate just enough (oDOT capital) to win election, not more.
- `k*` → open only as many full slots as the scarcer of eDOT / oDOT can fund.
**What Orbit does:** automate this every era — eDOT funds `σ`, oDOT funds `ν`, and pause or queue mints when the mix breaks (Section 7.3).



### 7.1 A margin above the floor

Purely mechanically, sitting exactly at the 10,000 DOT minimum risks falling below it (and being permissionlessly chilled) on any negative price or reward-calculation drift. In practice the protocol should hold a small operational margin above 10,000 DOT per slot — this trades a small amount of theoretical weight-efficiency for materially lower operational risk, and should be sized empirically against observed self-stake volatility, not fixed by formula.

### 7.2 Operational cost is the real constraint, not math

Every additional slot means another StakingOperator relationship, another set of session keys, another node to monitor for equivocation/downtime risk, and another election threshold to track. The math in §7.0 says "more slots is strictly better"; it does not account for the marginal cost of managing the k-th relationship. In practice k is capped by operational capacity **and** by vault mix (Section 7.3), not by the formula alone — and that operational management (not the yield formula itself) is what a pooled protocol can do that an individual retail depositor cannot, which is the actual moat this protocol is selling.

**Self-cannibalization.** Incentive share is `B · w(σ_i) / Σ_j w(σ_j)` over the *whole* active set. Every new Orbit slot adds to the denominator. Growing `k` (Orbit's own roadmap) compresses `y_incentive` for Orbit's existing slots even with zero new external competitors — the same dynamic §13.5 models for outside capital. Treat "maximize k" as jointly maximizing weight *and* accepting faster pot dilution; publish live per-slot incentive as `k` scales.

### 7.3 Capital mix and circuit breakers

Target per-slot mix: `σ* : ν* ≈ 10,000 : (T_min − 10,000)` (roughly ~1 : ~144 at the illustrative T_min in §6.3). Live deposits will not follow that ratio automatically.

**If eDOT outruns oDOT** (not enough nomination to elect bonded slots): pause or queue **eDOT** mints; do not open under-backed slots; optionally raise the oDOT fee share / incentives until `C_o` catches up.

**If oDOT outruns eDOT** (excess nomination, few bonds): stop opening new slots; oDOT still earns base yield as nominator capital; optionally pause further oDOT growth into non-Orbit validators only if policy says Orbit-only nomination — default is keep nominating Orbit slots first, then overflow policy documented at launch.

**Hard rules (v1 intent):**

1. Never bond a new stash without `ν ≥ T_min − σ` committed from the oDOT pool (or a published temporary buffer).
2. Publish live `φ = Σσ / (Σσ+Σν)` and `k_openable` on the dashboard — `φ_target ≈ 0.69%` is the design point at target mix, not a promise under arbitrary deposit mix.
3. Election shortfall → chill/unbond path for excess eDOT rather than silent unelected bonds earning nothing.

---



## 8. Token Design & Naming



### 8.1 Two tokens, two risk levels


| Token    | Backing                     | Slashable?                                    | What it's for                                                                      |
| -------- | --------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| **oDOT** | Pooled nomination           | No Hub slash (custody risk separate — §10.1, §11) | Hold, trade, use in DeFi; steady base yield                                   |
| **eDOT** | Pooled validator self-stake | Yes (first in line if a validator misbehaves) | Higher yield from the self-stake incentive; you accept slash risk for that premium |




### 8.2 Naming

**oDOT** — Orbit DOT. The default liquid staking receipt.

**eDOT** — bonded / elevated DOT (working name: *escape velocity* in internal docs). Same orbit metaphor: oDOT is the stable path; eDOT is the extra push into validator self-stake yield.

Name check against existing Polkadot LSTs: vDOT (Bifrost), LDOT (Acala), xDOT (Equilibrium), sDOT (Lido on Moonbeam), aDOTb (Ankr). StellaSwap's stDOT is sunset. oDOT and eDOT don't collide with any live ticker we're aware of.

### 8.3 Reserved: ORB

A third token, a governance/fee-accrual token (working name ORB), is reserved as future scope. It is not launched at v1, has no emissions schedule defined in this document, and its distribution mechanics are deliberately out of scope here this document covers only the two liquid staking tokens and the protocol that backs them.

### 8.4 Why two tokens instead of one blended LST

If you mixed nomination and self-stake into a single receipt, the blended rate on a full validator slot is only ~3.5% (Section 6.4) — barely above plain staking — because self-stake is tiny next to the nomination needed for election. Two tokens don't change how much DOT the protocol earns; they let **you** choose: **oDOT** if you want no slash exposure, **eDOT** if you want the self-stake incentive and accept slash risk.

---



## 9. Share Accounting & Exchange-Rate Mathematics

Both tokens follow standard share-token accounting: each token represents a claim on a growing pool, and the exchange rate — not the token balance — carries yield.

### 9.1 Mint and exchange rate

For token T ∈ {oDOT, eDOT}, backing pool value V_T (DOT-denominated, including accrued rewards), and outstanding supply S_T:

```
rate_T  =  V_T / S_T
```

On deposit of d DOT into pool T:

```
ΔS_T  =  d / rate_T  =  d · S_T / V_T

V_T  +=  d
S_T  +=  ΔS_T
```

Rewards accrue by increasing V_T directly (via observed on-chain staking reward events) without minting new supply. Since S_T is unchanged by a reward-accrual event and V_T only increases from one, rate_T = V_T/S_T is non-decreasing between mint/redeem events, and strictly increasing whenever a reward event occurs — this is a direct consequence of how accrual is defined, not a separate assumption.

**Hub routing into each vault.** Era rewards are attributed by Hub account, not re-split inside Orbit. Nominator-path rewards on oDOT-backed nomination credit `V_oDOT`. Base yield on bonded self-stake `σ` plus the self-stake incentive credit `V_eDOT`. Orbit does not take a slot's total `(σ+ν)·y_base` and blend it across vaults after the fact.

**What this means.**

- `V` = DOT (and rewards) sitting in the vault.
- `S` = how many oDOT or eDOT shares exist.
- `rate = V / S` = how much DOT one share is worth.
When you deposit 100 DOT at rate 1.0 you get 100 shares. When rewards make `V` grow, your 100 shares are each worth more — you didn't get more tokens; the tokens got heavier.
**What Orbit does:** update `V` from Hub staking reward events and mint/burn `S` only on deposit/redeem.



### 9.2 Redemption

Redeeming s shares of T:

```
d_out  =  s · rate_T
S_T   −=  s
V_T   −=  d_out
```

subject to the liquidity constraints in §12 — redemption of eDOT in particular may need to queue behind the (now short, ~24–48h) unbonding period if the instant-liquidity buffer is exhausted.

### 9.3 Inflation-attack protection, formally

The classic first-depositor share-inflation attack: an attacker mints a tiny amount of shares first (e.g. 1 unit), then donates a large amount of DOT directly to the pool's underlying balance without minting shares, artificially inflating rate_T = V_T/S_T. A subsequent honest depositor's shares are then computed as ⌊d · S_T / V_T⌋, which rounds down to zero if V_T has been inflated far enough relative to the honest depositor's size — letting the attacker later redeem their 1 share for a rate_T that now effectively includes the victim's donated-in deposit.

The standard mitigation — burning a large minimum initial deposit S_0 to a null address at pool genesis — works because it fixes a floor under S_T that the attacker cannot reduce. With S_T ≥ S_0 always, a legitimate depositor's maximum possible loss from share-rounding is bounded: at most one unit of share, worth at most rate_T DOT — a fixed, small, protocol-chosen amount, *not* proportional to the size of the attacker's donation. Choosing S_0 large (equivalent to several thousand DOT, burned) makes the attacker's own capital-at-risk large relative to any plausible extractable profit, while the maximum possible victim loss stays capped at that same fixed, tiny amount no matter how much the attacker donates. This is the same mitigation used by the ERC-4626 tokenized-vault standard, applied here independently to both oDOT and eDOT.

### 9.4 Monotonicity under slashing

rate_eDOT is monotonically increasing *except* on a slash event, when V_eDOT drops by the slashed amount instantly. rate_oDOT is designed to never decrease from Hub slashing at all — under nominator rules slash cannot hit oDOT backing; see §10.1A. (Custody failure is a separate threat — §10.1B / §11.)

---



## 10. Risk Model: Slashing, Coverage



### 10.1 Two threat classes (do not conflate)

**(A) Hub slashing (protocol rule).** Post-reform, nominator stake is **unslashable**. A slash of size L against a validator slot's self-stake hits **eDOT only**:

1. L is deducted from that slot's contribution to V_eDOT, capped at that stash's bonded self-stake (a validator cannot lose more than it bonded on Hub).
2. Within the **eDOT pool**, that loss is socialized across eDOT sharers (all eDOT holders take a pro-rata NAV hit) — this is pool accounting, not Hub clawing unbonded funds beyond the stash.
3. **V_oDOT is not reduced by Hub slash.** Nomination backing stays under nominator rules. oDOT's rate should not fall because a validator was slashed.

**(B) Custody / ops failure (Orbit trust boundary).** Theft, malicious multisig, mis-accounting, or a buggy vault can impair **either** pool. That is not "slash waterfall into oDOT" — it is a separate security failure mode addressed in Section 11. Diversification of operators (independent infra / geography) still matters for reducing correlated **slash** events on eDOT (§10.4); it does not make oDOT slashable.


### 10.2 Why the exposure is small by construction

Because the yield-optimal strategy from §7 is *also* "minimum self-stake per slot, maximize slot count," the fraction of total protocol TVL that is slashable at all is structurally small. Define:

```
φ  =  Σ_i σ_i  /  ( Σ_i σ_i + Σ_i ν_i )
```

At the **target** minimum-self-stake, minimum-clearing-nomination mix, using the illustrative per-slot figures from §6.4 (σ = 10,000, ν = T_min − σ ≈ 1,430,000, T = 1,440,000):

```
φ_target  ≈  10,000 / 1,440,000  ≈  0.69%
```

That figure is a **design target**, not an automatic outcome. Live `φ` = Σσ/(Σσ+Σν) moves with deposit mix; circuit breakers in §7.3 exist so the protocol does not pretend otherwise. At target mix, even a **100% loss across every Orbit self-stake simultaneously** would impair about 0.69% of total protocol TVL (slashable layer only) — and Hub rules still keep nominator oDOT out of that slash. Track live `φ` as an ops metric.

**What this means.** At target mix, ~0.7% of TVL is slashable self-stake; **eDOT holders** still bear 100% of that thin layer. **What Orbit does:** keep `σ` small, grow `k`, and enforce vault mix so live `φ` stays near `φ_target`.

### 10.3 Coverage ratio and eDOT's real risk

φ is Orbit's protocol-wide exposure, but eDOT holders' personal exposure is different: they hold 100% of the slashable layer, concentrated. eDOT's effective "coverage ratio" — how much of a single-slot total slash it can absorb before impairing principal — is a direct function of how many independent slots eDOT capital is spread across. A slash against one of k diversified slots impairs eDOT's pool by roughly 1/k of the slot's self-stake relative to total eDOT backing, not the full amount. This is standard insurance-style diversification and is the reason §7's "maximize k" conclusion matters as much for eDOT's own risk profile as for protocol-wide yield.

### 10.4 Diversification as variance reduction, formally

§10.2 showed that spreading self-stake thin across many slots keeps *expected* slashable exposure (φ) small. A separate, complementary argument shows it also reduces the *variance* of eDOT's realized loss — a different risk property, and one that matters independently.

Model each of Orbit's k validator slots as facing an independent slash event in a given period with small probability q and, conditional on a slash, an expected severity fraction ℓ of that slot's self-stake (real severity varies by fault type — minor unresponsiveness slashes are far smaller than equivocation slashes; ℓ here is a single expected-severity simplification). Total realized loss across k slots is:

```
L  =  Σ (i = 1 to k) X_i,     X_i  =  { ℓ·σ  with probability q
                                       { 0    with probability 1−q     (i.i.d. across i)

E[L]    =  k · q · ℓ · σ
Var(L)  =  k · q·(1−q) · (ℓσ)^2
```

Expected loss scales **linearly** with k — diversification cannot reduce how much loss you expect on average, since each additional slot is additional slashable exposure. What it changes is the *predictability* of that loss relative to the pool it sits in. eDOT's backing pool V_eDOT also scales with k·σ, so expected loss as a fraction of the pool stays constant while the standard deviation of that fraction shrinks:

```
sd(L) / (k·σ)   =   √(k·q(1−q)) · ℓσ  /  (k·σ)   =   ℓ · √( q(1−q) / k )   ∝   1/√k
```

This is the standard insurance-pooling result: diversifying an i.i.d. risk across k independent units leaves the *expected* loss ratio unchanged but shrinks its *standard deviation* by 1/√k. In other words — spreading self-stake across many validators doesn't lower how much loss eDOT should expect to take on average, but it makes any single period's realized loss far more predictable and far less likely to be a severe outlier. This is the formal justification for the "independent operators, independent infrastructure, independent geography" requirement for eDOT slash risk: the 1/√k benefit is real only to the extent slash events across slots are actually statistically independent. Correlated infrastructure — many slots on the same cloud provider, or the same client software bug — breaks the independence assumption entirely and should be actively managed as an operational risk, not assumed away by slot count alone.

---



## 11. Protocol Architecture & Trust Model



### 11.1 Where this lives

Staking, balances, and governance live on Polkadot Asset Hub (Nov 2025 consolidation). Hub is still where Orbit **calls staking** — nominate, bond, `StakingOperator`.

**MVP path (this quarter):** Orbit vault accounting is a **FRAME parachain runtime** spun on **Zombienet** — pallets for oDOT/eDOT shares, exchange rate, slash accounting, operator registry. **No Solidity / Revive contracts for MVP.** Chopsticks forks Hub staking state so the PoC can talk to real storage shapes. Local XCM stubs are a **lab convenience**, not a claim that production must be cross-chain — the §2 "staking on Hub" thesis still holds: production staking extrinsics target Hub; a separate parachain is optional.

**Production:** staking stays on Hub. Preferred path if pallets prove unnecessary: thin Hub-adjacent accounting (minimizes XCM). Alternate: graduate the Zombienet runtime to Paseo → mainnet parachain if custom pallets win (Phase 4, Section 18).

See **Section 3** for the plug-in map. DeFi order: Hydration peg → Acala/HOLLAR → broader EVM. JAM is a future hook (Section 19), not a ship gate.

### 11.2 The real trust boundary: stash key custody

There is currently no turnkey path for a vault (pallet or contract) to fully own a validator stash and call staking extrinsics without a human key set. v1 custody of each validator slot's stash key is the actual trust boundary — not a solved problem the accounting layer abstracts away. The StakingOperator proxy solves the *operator* side non-custodially (the node-running operator can never move funds and can be revoked instantly) — it does not solve who holds the stash key itself.

**v1 custody sketch (to be finalized before mainnet, not a production commitment yet):** target **3-of-5** threshold multisig; signers drawn from distinct legal entities / ops teams with no shared cloud account, hardware vendor, or jurisdiction where practical; signer set and rotation policy published with the audit. Until that publish, treat custody as **unsolved naming** — "Orbit multisig" is a role, not a named board.

Mitigations for v1:

- Stash keys held under threshold multisig, not a single signer (illustrative 3-of-5 above — confirm at launch).
- Every stash address published on-chain and independently verifiable against the protocol's declared validator set.
- NAV (pool value for oDOT and eDOT) verifiable against real Hub staking-ledger state, not self-reported by the custody layer (see NAV freshness below).
- **Escape hatch (goal / phased):** v1 documents a withdrawal-favoring incident playbook (multisig rotation, public stash list, pause mints). A path that unwinds user positions **without** active multisig cooperation (e.g. timelocked escape extrinsic, guardian set, or pre-authorized unbond) is a **v2 / custody-harden** item (Section 11.3) — not a claim that v1 already has trustless forced exit.

#### NAV source of truth and stale-state pauses

If vault accounting lives on an Orbit parachain while stake lives on Hub, `rate_T = V/S` must track Hub ledger truth. XCM delay, forks, or indexer lag can desync mint/redeem.

**v1 rules (intent):**

1. **Source of truth:** Hub staking ledger (and balances) for bonded/nominated amounts; Orbit runtime only mirrors for share math.
2. **Freshness bound:** if Hub view is older than a configured threshold (or proofs fail), **pause mints and instant redemptions**; queued protocol redeem may still proceed once state is fresh.
3. **No optimistic mint** against stale "rewards accrued" without a Hub-attested update.

### 11.3 Roadmap item: tighter custody

If staking precompiles (or pallet-native custody patterns) land such that Orbit can hold stash authority without a human multisig, migrate there — and ship a real cooperation-free escape hatch at that point. Until then, multisig stash + `StakingOperator` is the v1 model. Not a v1 claim that custody is fully automated or that users can force-exit without the custody layer.

### 11.4 Parachain: PoC now, mainnet later (optional)

**Local / testnet parachain now (MVP).** A Zombienet Orbit runtime is how we validate product math — FRAME pallets, real block production, XCM stubs to Hub-like staking. That is parallel PoC work, not “we’re buying Coretime tomorrow.”

**Mainnet sovereign parachain later (optional Phase 4).** Staking already lives on Hub. A day-one mainnet appchain would reintroduce Coretime, collators, and XCM back to Hub for little user-facing gain. Promote the runtime only if Hub limits become real (custom slot logic, fee policy, sovereignty). Until then: PoC on Zombienet/Paseo; production staking calls stay Hub-facing.

### 11.5 Formal threat model: multisig compromise probability

The independence assumption is the whole ballgame. If several signers share a key-management vendor, hardware wallet firmware, jurisdiction, or phishing surface, compromise probabilities are correlated and any i.i.d. binomial estimate is badly optimistic. Signer diversity (distinct hardware, custody providers, individuals, no shared ops dependency) is a **precondition**, not a nice-to-have.

For an m-of-n threshold, an attacker needs ≥ m signers. Under a *purely illustrative* i.i.d. model with per-signer compromise probability q:

```
P(compromise)  =  Σ (j = m to n)  C(n, j) · q^j · (1−q)^(n−j)
```

Example (3-of-5, q = 1%/year, i.i.d.): the formula yields a very small annual probability — small enough to be **misleading** if quoted without the independence caveat. Treat it as "why thresholds help when independence holds," not as Orbit's residual risk rate.

**Correlated scenario (more realistic diligence framing):** if two of five signers share an ops dependency, the effective threshold against that dependency collapses toward 2-of-remaining or worse. Diligence should ask about signer graph diversity, not the optimistic binomial tail.

**Insider / collusion risk** is not covered by the external-compromise model. Legitimate signers can collude or exit-scam. Until signers are named and legally constrained, treat insider risk as **first-order**, not residual after the binomial example.

**Operational independence (intent, not yet enforced on-chain):** cap slots per cloud provider / client binary; require ≥2 geographic regions among operators; require distinct custody vendors among multisig signers. Publish breaches of these caps as risk events.


---



## 12. Liquidity, Peg & Redemption Mathematics



### 12.1 A no-arbitrage bound on the instant-redemption discount

Any liquid staking token offering instant redemption at a discount to underlying NAV creates an arbitrage opportunity the moment that discount is mispriced. Suppose Orbit offers instant redemption of 1 share at (1−δ)·rate_T for some discount δ, while the "patient" path — queueing through the underlying unbonding period t_unbond — pays the full rate_T plus t_unbond/365 of additional yield y accrued while waiting. A rational holder (or arbitrageur) compares the two paths and takes the instant-redeem discount only when it's cheaper than the cost of waiting:

```
instant-redeem strictly dominates waiting   ⟺   δ  >  y · t_unbond / 365
```

If δ is ever priced above this bound — by the protocol directly, or by a secondary-market seller panic-discounting the token — arbitrageurs will mint or acquire the token and instantly redeem it, draining the buffer for a profit strictly larger than they'd have earned simply waiting for unbonding. That trade persists, and keeps draining the buffer, until δ is pushed back down to the bound. This gives both an upper limit the protocol should never *set* pricing above, and a market-clearing target the secondary-market peg converges to on its own, independent of protocol pricing:

```
δ*  =  y · t_unbond / 365
```

At y ≈ 3% and t_unbond ≈ 2 days:

```
δ*  ≈  0.03 × 2 / 365  ≈  0.00016  ≈  0.016%
```

— small enough that a modest instant-liquidity buffer, not a large one, is sufficient to hold the peg tight. Because δ* is directly proportional to t_unbond, the collapse from a 28-day to a ~2-day unbonding period (Section 5.1) matters mechanically, not just narratively: it shrinks the maximum defensible discount — and therefore the value at risk if the buffer is ever temporarily exhausted — by the same 14–28x factor.

**What this means.** If waiting ~2 days to unbond costs you about `3% × 2/365` ≈ 0.016% of yield, nobody should accept a worse haircut than that for calm "instant" exit — or arbitrage drains the buffer. **δ* is a no-arbitrage floor in orderly markets, not bank-run peg insurance.** Under fear, de-pegs are about Hydration depth, confidence, and mass redemption — stress-test buffer + Omnipool liquidity against coordinated runs (§12.2), not against δ* alone. **What Orbit does:** size the free-DOT buffer and Hydration liquidity around δ* for calm arb, and separately stress for panic flows.

**eDOT needs its own bound.** Instant-redeem fees on eDOT (§13.1) should not reuse oDOT's 0.016%. Using the same formula with a higher opportunity yield (illustrative blended ~3.5%, or incentive-heavy holders thinking in self-stake terms):

```
δ*_eDOT (blended ~3.5%)  ≈  0.035 × 2 / 365  ≈  0.019%
```

If a holder marks opportunity cost near the incentive slice alone, δ* is larger still — price eDOT's instant path off **eDOT's** foregone yield, not oDOT's 3%.

### 12.2 Buffer sizing

Modeling daily net redemption flow as approximately normal with mean μ and standard deviation σ_flow (estimated empirically post-launch, not assumed), an instant-liquidity buffer sized to cover the 99th percentile of a t_unbond-day redemption window is:

```
Buffer  ≈  μ · t_unbond   +   z_0.99 · σ_flow · √t_unbond
```

This formula has two terms that scale differently with t_unbond, and collapsing them into a single "buffer is N× smaller" statement is imprecise — which term dominates matters. The first term (μ·t_unbond, driven by average net outflow) scales *linearly* with t_unbond: shrinking t_unbond from 28 days to 2 days shrinks this term by a full 14x. The second term (z_0.99·σ_flow·√t_unbond, driven by day-to-day volatility of flows) scales with the *square root* of t_unbond: the same shrink reduces this term by only √14 ≈ 3.7x. Which reduction actually dominates the total buffer depends on whether μ (average net daily outflow) or σ_flow (day-to-day volatility of net flow) is the larger contributor — in practice, net redemption flow across many independent depositors tends to average close to zero over short windows (deposits and redemptions roughly offset), making the buffer volatility-dominated and the realistic reduction closer to the ~3.7x figure than the full 14x. This should be checked against actual post-launch flow data, not assumed from the formula alone.

The normal approximation itself is a Central Limit Theorem convenience, valid when redemption requests arrive from many roughly-independent depositors, and should be treated as a first-pass sizing tool rather than a tail-risk guarantee: a coordinated mass redemption — a de-peg scare, or a correlated shock hitting every Polkadot LST simultaneously — produces fatter tails than a normal distribution captures. The buffer size computed above should be treated as a floor to stress-test against historical redemption-run data from comparable protocols before launch, not a number to rely on unstressed.

---



## 13. Economic Model: Fees, Revenue, Break-Even



### 13.1 Fee structure

- oDOT: a standard liquid-staking protocol fee on realized base yield (e.g. in the 5–10% range common to established LSTs), kept low because oDOT competes directly against passive nomination, which has zero protocol fee.
- eDOT: a higher performance fee on the *incentive-layer* yield specifically (not on base yield), justified by the active management described in §7.2 — slot targeting, self-stake sizing, operator relationship management, election-threshold monitoring — none of which a passive nominator or a passive existing LST currently does.
- A small instant-redemption fee on eDOT only, sized against the buffer economics in §12.2, to discourage buffer-draining behavior without meaningfully affecting long-term holders.

### 13.1.1 Operator economics

Node operators are paid from a **share of the eDOT incentive-layer performance fee** (not from oDOT base fees by default). Exact split is a launch parameter (protocol treasury vs operators), published with the fee schedule.

- **SLA intent:** uptime / no equivocation / timely session-key rotation; material breach → remove `StakingOperator`, rotate to a standby operator, and forfeit accrued operator fee for the period.
- **Slash:** Hub slash hits eDOT holders first (§10.1A). Operators who caused the fault are removed and may face contractual / bonded operator penalties where legally and operationally enforceable — they do not get a free option on user slash losses.
- **Chill / wind-down:** Orbit can revoke operator proxies immediately; stash remains under multisig so funds are not stranded with the node runner.

### 13.2 Revenue

```
Revenue  =  f_o · V_oDOT · y_base   +   f_e · V_eDOT · y_incentive
```

Fee on oDOT = a cut of base yield. Fee on eDOT = a bigger cut of incentive yield (the part Orbit actively manages); a portion of `f_e` accrues to operators (§13.1.1). Incentive APR can be high while eDOT TVL is small, so protocol revenue still sits on that thin slice. Fees are taken in Orbit vaults, not by changing Hub staking.

Because incentive-layer yield on self-stake (pot-structured; see §5.3) is far larger than y_base (~3%), and eDOT is the smaller pool **at target mix** (`φ_target ≈ 0.69%` per §10.2), most protocol fee revenue comes from a thin slice of TVL — the part actually earning the incentive premium. Live revenue tracks live mix, not the target alone.

### 13.3 Break-even

Here `φ` means **eDOT's share of protocol TVL at the fee blend** — which equals §10.2's slashable-backing ratio **only at target mix** when all oDOT is deployed as Orbit nomination (`φ_target`). If deposit mix differs, use live `V_eDOT / (V_oDOT + V_eDOT)` in this formula, not `φ_target`.

```
TVL_break-even  =  Fixed costs (audits, keepers, operator relationship
                    management, infra)
                    ────────────────────────────────────────────────
                    f_o · y_base · (1−φ_TVL)   +   f_e · y_incentive · φ_TVL
```

**Illustrative plug-in (not a forecast):** suppose fixed costs = 150,000 DOT/year equivalent, `f_o = 8%`, `f_e = 20%` of incentive layer, `y_base = 3%`, `y_incentive = 40%` (compressed vs the §5.3 anecdote — see §13.5), `φ_TVL = φ_target ≈ 0.69%`:

```
denom  ≈  0.08·0.03·0.9931  +  0.20·0.40·0.0069
       ≈  0.002383  +  0.000552
       ≈  0.002935

TVL_break-even  ≈  150,000 / 0.002935  ≈  51M DOT
```

For scale: this is more than 2× Bifrost's entire current vDOT TVL (~21M DOT at ~2.4% of ~883M staked, §15.3) — a reminder that break-even at these fee/yield assumptions requires becoming a market leader, not a niche book.

Order-of-magnitude only: change costs, fees, or compressed `y_incentive` and the breakeven moves hard. Recompute at launch with real quotes.

### 13.4 Equilibrium and capacity

The self-stake incentive is a fixed budget (22.6% of DAP) divided among however much self-stake competes for it. As more capital (Orbit's or competitors') flows into self-staking, y_incentive compresses — expected under a fixed pot and concave weights. Orbit's yield advantage is therefore a moving target that shrinks as the self-stake capture trade becomes more crowded, which is why the "why now" framing in §2 matters: the advantage is largest early, while few participants have organized capital around this specific reform.

### 13.5 Modeling the equilibrium compression path

§13.4 states this qualitatively. Making it quantitative requires being explicit about *how* new capital enters the self-stake market, because the compression speed depends on that assumption — this is worth showing rather than picking one silently.

**Scenario A — new entrants copy Orbit's own strategy** (more validators, each at the same minimum self-stake size). If the number of self-staking validators N grows while each holds the same σ, aggregate self-stake is Σ = N·σ, and every validator's incentive share stays at exactly B/N regardless of the concavity exponent p — because when all competitors are the same size, the concave weighting has nothing to differentiate between them, and everyone reverts to an even 1/N split. Converting to a rate:

```
y_incentive  =  (B/N) / σ  =  B / (N·σ)  =  B / Σ
```

Under this scenario, the incentive rate compresses **linearly** in Σ — doubling aggregate self-stake exactly halves the rate, independent of p.

**Scenario B — the existing background of validators scales up self-stake proportionally**, while Orbit holds its own σ fixed at the floor. Here the entire competing distribution grows by a common multiplicative factor as background self-stake increases. Because the incentive-budget denominator (the sum of all competitors' σ_j^p) scales with the p-th power of that common factor while Σ scales linearly with it, the denominator scales as Σ^p, and Orbit's own incentive rate — holding its σ fixed — becomes:

```
y_incentive(Σ)  ≈  B / ( σ^(1−p) · Σ^p )
```

At p = 1/2, this is y_incentive ∝ 1/√Σ — a **square-root**, slower-than-linear decay. Under this scenario it takes a quadrupling of background aggregate self-stake to halve Orbit's rate, not a doubling.

**Which scenario is realistic?** Almost certainly some mix of both — new participants at minimum-viable sizes (A) and background validators scaling self-stake (B). True compression sits between linear and square-root decay; track live.

**Applying that to the §5.3 anecdote.** If today's reported ~73% on 10k σ were real for a marginal slot, and aggregate competing self-stake Σ doubled with Orbit also adding slots (self-cannibalization + Scenario A), a linear read halves the rate toward ~35–40% on self-stake — still above base yield, but not a 73% brochure number. Under slower Scenario B decay, the drop is milder. **Do not quote 73% as a forward APY**; quote a range under "Σ doubles / triples" using live pot size once measured.

§2's timing still holds: the advantage is largest early, before competing capital (including Orbit's own `k`) organizes.

---



## 14. How People Use Orbit

This section is the practical half of the whitepaper: what someone actually does in the app, and how oDOT/eDOT move through Polkadot DeFi. Math lives in Sections 5–13; this is the walkthrough.

### 14.0 End-to-end flow

One picture of the whole product:

```
                         ┌─────────────────────────────────────┐
                         │           Orbit App (UI)            │
                         │   Connect wallet · Deposit · Exit   │
                         └──────────────┬──────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
           ┌────────────────┐                      ┌────────────────┐
           │  oDOT vault    │                      │  eDOT vault    │
           │  (nominate)    │                      │  (self-stake)  │
           └────────┬───────┘                      └────────┬───────┘
                    │                                       │
                    │  nominate                             │  bond ≥10k DOT
                    │                                       │  + StakingOperator
                    └───────────────────┬───────────────────┘
                                        ▼
                         ┌──────────────────────────────────┐
                         │   Orbit validator slots (many)   │
                         │   Operators run nodes only       │
                         │   Stash under Orbit multisig     │
                         └──────────────────┬───────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
             Hold & earn            Hydration swap            Redeem / unbond
             (rate ticks up)        oDOT ↔ DOT                (~24–48h for oDOT)
                    │                       │
                    │                       ▼
                    │              Borrow / LP (partners)
                    │              e.g. HOLLAR, Omnipool
                    ▼
             Wallet balance: oDOT and/or eDOT
```

**Short version:** DOT in → oDOT (safe) or eDOT (self-stake yield) → hold, trade on Hydration, or redeem back to DOT.

### 14.1 Who uses what


| User                 | Typical choice      | Why                                                      |
| -------------------- | ------------------- | -------------------------------------------------------- |
| Retail staker        | oDOT                | Set-and-forget liquid stake, no Hub slash (custody risk remains — §10.1/§11), use in DeFi |
| Yield-focused holder | eDOT                | Chasing self-stake incentive; accepts slash risk         |
| Both                 | oDOT + eDOT         | Split allocation (e.g. 80/20 safe/boost)                 |
| DeFi user            | oDOT (v1)           | Collateral / LP on Hydration; eDOT when partners list it |
| Validator operator   | Partners with Orbit | Runs node via `StakingOperator`; doesn't hold user keys  |




### 14.2 Deposit — mint oDOT (safe path)

```
You                    Orbit app                 On-chain
 │                         │                        │
 │  Connect wallet         │                        │
 │  (Talisman / SubWallet) │                        │
 │────────────────────────>│                        │
 │  Deposit 100 DOT        │                        │
 │  Choose "oDOT"          │                        │
 │────────────────────────>│  Nominate validators   │
 │                         │───────────────────────>│  Staking on Asset Hub
 │                         │  Mint oDOT shares      │
 │<────────────────────────│<───────────────────────│  oDOT balance in wallet
 │  100 oDOT (rate grows   │                        │
 │   as rewards accrue)    │                        │
```

**What you see:** balance in oDOT; exchange rate ticks up over time. **What you don't do:** pick validators, manage unbond queues, or run infrastructure.

### 14.3 Deposit — mint eDOT (self-stake path)

Same flow, but you choose **eDOT**. Orbit bonds your DOT as validator self-stake on Orbit-operated slots (with professional operators on `StakingOperator` proxies). You receive eDOT; yield includes the self-stake incentive layer. **You can lose principal** if those validators slash — see Section 10.

Orbit uses **oDOT** from the nomination pool to back the same validators for election. You do not need to deposit both yourself — but the protocol **cannot magically rebalance** separate vaults. If eDOT mints outrun oDOT nomination, eDOT deposits pause/queue until election backing exists (§7.3). If you only hold eDOT, you still depend on other depositors’ oDOT (or protocol buffers) for slot election.

### 14.4 Hold and earn

- Rewards land in the pool; your **share count stays fixed**, **exchange rate rises** (Section 9).
- Check APY from on-chain era rewards, not wallet headline inflation APIs (Section 5.4).



### 14.5 Exit — three ways


| Path                       | Speed                            | Best for                        |
| -------------------------- | -------------------------------- | ------------------------------- |
| **Swap on Hydration**      | Instant (if pool has liquidity)  | Traders, DeFi users exiting now |
| **Protocol redeem (oDOT)** | ~24–48h unbond                   | Full NAV, patient exit          |
| **Protocol redeem (eDOT)** | Unbond + possible slot wind-down | When buffer is empty; may queue |


Instant swap may trade slightly below NAV if the market is stressed (Section 12.1). That's normal for LSTs.

### 14.6 DeFi flows (v1 targets — order matters)

Ship DeFi in this sequence. Do not skip ahead until the prior step holds.

**1. Hydration peg (first)**  
oDOT ↔ DOT on Omnipool (or successor pools). Seed liquidity; prove the peg under small stress. Instant exit path lives here (Section 14.5).

**2. Acala / HOLLAR (second)**  
Once peg + volume exist: oDOT as collateral → mint **HOLLAR** or borrow DOT → optional re-stake loops. Partner liquidation rules apply; not Orbit-native debt.

**3. Broader EVM (third)**  
After Hydration + Acala paths are live: expose oDOT (then eDOT if listed) to wider EVM surfaces (Hub Revive, Moonbeam/Snowbridge-class bridges, etc.). Composability expands only after peg and stablecoin loops are proven.

**Also in v1 scope**  

- Simple hold: DOT → oDOT → hold.  
- LP fees on Hydration (oDOT/DOT or oDOT/HOLLAR) once pools exist.  
- **eDOT in DeFi:** later — slashable and more volatile; list after oDOT peg is proven.



### 14.7 Example scenarios

**Scenario 1 — Conservative Alice**  
Deposits 500 DOT → oDOT. Holds one year. Uses 200 oDOT on Hydration as collateral to borrow HOLLAR for spending; keeps earning stake yield on full backing. Never touches eDOT.

**Scenario 2 — Max yield Bob**  
Deposits 200 DOT → eDOT. Accepts slash risk for higher incentive-layer return. Does not loop; monitors Orbit dashboard for validator health.

**Scenario 3 — Split Carla**  
400 DOT → 320 oDOT + 80 eDOT. Most capital safe and DeFi-ready; small sleeve on self-stake incentive.

**Scenario 4 — Quick exit Dan**  
Needs DOT tomorrow. Swaps oDOT → DOT on Hydration. Pays spread/slippage; skips unbond queue.

**Scenario 5 — Operator Eve**  
Runs validator hardware. Orbit holds stash; Eve has `StakingOperator` only. Earns operator fee share (Section 13); never custodies user DOT.

### 14.8 What's not in v1

- Social login / card on-ramp  
- Single blended token (must pick oDOT or eDOT at deposit)  
- External Service-deposit / capacity products (future — Section 19; not Gray Paper restaking)  
- Native Orbit stablecoin  
- Cross-chain (Snowbridge / Hyperbridge) — after Hydration → Acala → EVM sequence
- JAM staking-Service adapter / deposit sleeves — Section 19; not MVP



### 14.9 PoC vs this spec

Repo today still has a legacy Solidity single-vault experiment. **MVP does not continue that path.** Next code is a **Zombienet parachain runtime** (FRAME) with dual oDOT/eDOT pallets — Section 17.

---



## 15. Competitive Landscape



### 15.1 Landscape


| Protocol            | Token | Targets self-stake incentive? | Separate slashable liquid token? |
| ------------------- | ----- | ----------------------------- | -------------------------------- |
| Bifrost             | vDOT  | No                            | No                               |
| Acala               | LDOT  | No                            | No                               |
| Equilibrium         | xDOT  | No                            | No                               |
| Lido (via Moonbeam) | sDOT  | No                            | No                               |
| StellaSwap          | stDOT | Sunset March 2026             | —                                |


Every existing Polkadot LST pools nominator-side stake undifferentiated and was designed before this reform existed. None currently separates a slashable self-stake layer from an unslashable nomination layer, and none actively targets the concave incentive curve described in §6–7. This is a genuine, currently-open gap — not a claim that these protocols can't add the same feature; they can, and the size of Orbit's advantage shrinks the moment a well-capitalized incumbent does.

### 15.2 A structural yield ceiling for undifferentiated LSTs

Since validator commission is forced to 0% under the reform (§5.1), and the self-stake incentive budget (22.6% of DAP) is paid only on a validator's own self-stake never on nominated capital — any liquid staking token that pools nominator-side stake exclusively is mathematically capped at the base staker-reward rate, y_base ≈ 3% real (§5.4), minus its own protocol fee, before it even reaches the market. This isn't a claim about any specific competitor's current advertised rate — verifying each protocol's live APY is out of scope for this document and would need to be re-checked at deployment — it's a structural ceiling that follows directly from the reform's own rules: there is no path to the incentive-layer premium without holding self-stake, and none of the protocols in §15.1 hold self-stake at all. Orbit's eDOT is differentiated specifically by being the one token in the market structured to hold that layer.

### 15.3 Broader market context

Polkadot's overall liquid-staking penetration sits around 3% of staked supply (Bifrost alone is ~2.4%), compared to roughly 36% on Ethereum and ~8.7% on Solana — a structurally underbuilt market independent of this specific reform, which is a secondary tailwind beyond the primary self-stake thesis.

---



## 16. Risk Disclosures

- The self-stake incentive weight function used throughout §6–7, §10, and §13 is a modeled approximation (square-root), not a confirmed on-chain formula. Re-derive from **staking pallet / runtime source** before deploying capital.
- All network-state figures are live snapshots; re-measure at deployment.
- The ~73% / "43 DOT/day" calibration is one self-reported forum data point — not a forecast. Prefer pot-structure math and §13.5 compression ranges (§5.3).
- `φ_target ≈ 0.69%` assumes target oDOT/eDOT mix; live φ can differ (§7.3, §10.2).
- Growing Orbit's own `k` dilutes the incentive denominator (self-cannibalization, §7.2).
- v1 stash custody is multisig trust; signers not yet named; insider collusion is first-order (§11.2–11.5). `StakingOperator` only covers the node-operator side.
- Hub slash hits **eDOT only**; custody/theft is separate (§10.1).
- δ* is a calm no-arb bound, not bank-run insurance; eDOT needs its own δ* (§12.1).
- **Code is unaudited** until a production audit lands on the roadmap (§17.2, §17.5). Treat MVP/testnet as experimental.
- **Governance risk:** the economic thesis depends on Referendum 1909-era DAP parameters (~months old at writing). A later referendum can change the split, the weight function, or the incentive pot itself.
- **Regulatory / legal risk** for issuing oDOT, eDOT, and any future ORB is real and jurisdiction-dependent — not analyzed here; seek counsel before public distribution.
- ORB / treasury / voting design is out of scope.


---



## 17. MVP: What We Build First

**Target: Q3 2026 (this quarter)** validate the product on a free local network, then public testnet. 

MVP build path: a **local Zombienet parachain runtime** (FRAME pallets) that implements vault math and talks to Hub-shaped staking (Chopsticks fork and/or XCM stubs). That proves oDOT/eDOT before any mainnet deployment decision.

### 17.1 MVP goals (in order)

1. **Orbit runtime (FRAME)** — parachain with oDOT vault pallet: deposit, mint shares, rising exchange rate, redeem.
2. **Wire to Hub staking shapes** — nomination against Chopsticks-forked / simulated Asset Hub staking storage (not a fake APR constant alone).
3. **eDOT pallet (thin)** — same share math; bond path + `StakingOperator` on at least one test validator slot.
4. **Mix / circuit-breaker stubs** — pause eDOT mint when nomination shortfall; surface live `φ` and `k_openable` (§7.3).
5. **Zombienet topology** — relay + Orbit parachain (+ Hub-like chain as needed); real block production and era timing.
6. **Simple UI** — Talisman / SubWallet, deposit, balance, redeem against the local / Paseo runtime.
7. **Pre-mainnet number gate** — derive `w(σ)` from staking runtime source; replace modeled √σ yields before any public APY claims.



### 17.2 What MVP deliberately skips


| Skip                                   | Why                                                              |
| -------------------------------------- | ---------------------------------------------------------------- |
| Solidity / Revive contracts            | FRAME runtime PoC first; contracts are not the MVP               |
| Mainnet Coretime / sovereign parachain | Zombienet + Paseo only; mainnet parachain stays optional Phase 4 |
| ORB / governance token                 | Product first                                                    |
| Account abstraction / Google login     | Crypto-native wallets only                                       |
| Deep Hydration / HOLLAR / EVM loops    | After peg exists (Hydration → Acala → EVM)                       |
| JAM staking-Service / deposit sleeves  | After oDOT/eDOT work; see Section 19                             |
| Production audit                       | After testnet proof                                              |




### 17.3 Tooling

```
  Your machine                         Public test
  ───────────                         ───────────
  Chopsticks  ── fork live Hub     →  real staking storage shapes
  Zombienet   ── Relay + Orbit     →  FRAME parachain PoC
       │         parachain runtime
       ▼
  Build / run Orbit pallets (Rust)
  Mint oDOT / eDOT with faucet DOT
       │
       ▼
  Paseo (or Hub testnet)  same flows with public peers
```

**Chopsticks** — forks Polkadot Hub / Asset Hub state. Good for: “do our extrinsics / XCM match real staking storage?”

**Zombienet** — multi-node local network (relay + Orbit parachain). This is the primary MVP lab: block production, pallet logic, election / era timing without waiting on public testnet.

**Paseo** — public proof. Faucet DOT, real peers, share a link. This is what you show when saying “MVP works.”

### 17.4 MVP architecture sketch

```
┌─────────────────────────────────────────────────────────┐
│  React UI  ·  Polkadot.js / Talisman                    │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Orbit parachain runtime (FRAME) — Zombienet / Paseo    │
│    · oDOT pallet (shares + rate)                        │
│    · eDOT pallet (shares + rate + slash accounting)     │
│    · operator registry                                  │
│  (no Solidity)                                          │
└──────────────────────────┬──────────────────────────────┘
                           │ staking calls / XCM / stubs
┌──────────────────────────▼──────────────────────────────┐
│  Polkadot Hub staking (forked or testnet)               │
│    · nominate (oDOT backing)                            │
│    · validate + StakingOperator (eDOT backing)          │
└─────────────────────────────────────────────────────────┘
```



### 17.5 After MVP

Audit path, Hydration peg, more validator slots, then mainnet Section 18. JAM rebind stays future — Section 19.

---



## 18. Roadmap

Rough quarters (revisit as product evidence lands). **MVP is Q3 2026.**


| Phase                              | When (rough)                 | What                                                                                                                                                                                           |
| ---------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0 — MVP**                        | **Q3 2026 (this quarter)**   | Zombienet Orbit parachain (FRAME): oDOT + thin eDOT, Chopsticks Hub shapes, basic UI, then Paseo. Validate product. No Solidity.                                                               |
| **1 — v1 mainnet**                 | Q4 2026 – Q1 2027            | Production oDOT/eDOT against Hub staking; multisig stash custody; `StakingOperator` operators; small slot set; margin above 10,000 DOT floor; **Hydration** oDOT peg/liquidity first.          |
| **2 — DeFi deepen**                | After peg holds              | **Acala / HOLLAR** collateral loops, then broader **EVM** surfaces. Grow slot count `k`; re-measure `T_min` and live incentive weights.                                                        |
| **3 — Custody harden**             | When primitives allow        | Tighter stash custody (precompile / pallet patterns) if available (Section 11.3).                                                                                                              |
| **4 — Optional mainnet parachain** | Only if needed               | Promote the Zombienet/Paseo runtime to mainnet Coretime — custom pallets, denser slot logic, fee policy, or sovereignty. Not required for v1 if Hub-facing staking + accounting already works. |
| **5 — JAM / Services**             | When JAM is live             | Rebind to JAM staking Service; optional Service-deposit / capacity sleeves (Section 19). Never a launch blocker.                                                                               |


**Why local parachain now, mainnet parachain optional later.** MVP needs a place to ship FRAME vault logic this quarter — that’s Zombienet. Users need liquid Hub staking — that’s Hub-facing calls. Buying Coretime is a separate decision after the product is validated.

**DeFi order stays fixed:** Hydration peg → Acala/HOLLAR → EVM.

---



## 19. How Orbit Plugs Into JAM

JAM (**Join-Accumulate Machine**) is the protocol defined in Gavin Wood’s [Gray Paper](https://graypaper.com/) as a prospective successor to today’s Relay Chain: a permissionless, mostly-coherent compute environment where **Services** (code + balance + state) replace the parachain-centric model for much of on-chain work. Execution is structured as **Refine → Accumulate** (in-core then on-chain); the VM is the **Polkadot Virtual Machine (PVM)**, not an “EVM clone.” Anyone can deploy a Service and buy **coretime** to induce work — similar in spirit to paying for gas, but scheduled across cores.

Orbit does **not** wait for JAM. MVP and v1 are **today’s Hub staking** + liquid **oDOT / eDOT**. This section is a compatibility map, not a dependency.

### 19.1 What the Gray Paper / Wiki actually imply (so we don’t invent APIs)

From the Gray Paper abstract and Polkadot Wiki (`learn-jam-chain`):

| Fact | Implication for Orbit |
| ---- | --------------------- |
| JAM hosts **Services** with code, **DOT balance/deposit**, and state; capacity scales with deposit | Liquid DOT (and later, receipts) can fund **Service deposits** — crypto-economic capacity, not a named “restaking market” in the Gray Paper |
| **Staking, coretime sales, governance** are expected to live as **Services** (app-level), while JAM itself is more fixed-function | Orbit’s staking plug-in may move from “Hub staking pallet” to “whatever Staking Service JAM runs” — same product job, new surface |
| A **CoreChains / parachains Service** is explicitly envisioned for Polkadot compatibility | Parachains don’t vanish; they become one Service among many. Orbit is not that Service |
| Security of JAM work is the chain’s validator / crypto-economic pipeline (guarantees, auditing, disputes) | Do **not** claim Orbit invents JAM’s security model. eDOT is not “JAM restaking” unless a future Service defines that |

What the Gray Paper does **not** specify (as of this writing): an EigenLayer-style marketplace where LST holders restake into arbitrary Services for yield. Any such market would be **built as a Service later**, not assumed from JAM itself.

### 19.2 What stays true for Orbit

- **oDOT** — liquid nomination-style receipt: DeFi collateral (Hydration → HOLLAR → EVM), base staking yield, no Hub slash under nominator rules.
- **eDOT** — liquid slashable self-stake / “skin” receipt for today’s validator incentive pot; natural candidate if a future Staking Service still needs bonded operator skin.
- **Multisig + `StakingOperator`** — custody/ops model for v1 against Hub; re-bind to the JAM-era staking Service when that Service exists.
- **No ship gate** — Q3 MVP and v1 mainnet do not require JAM live.

### 19.3 Honest plug-in points (design intent only)

```
  Today (Polkadot Hub)              Later (JAM-era)
  ────────────────────              ────────────────
  Hub staking pallet                Staking as a Service (likely)
  eDOT = validator self-stake       eDOT still wraps slashable skin
                                    if that Service keeps NPoS-like bonds
  oDOT = nomination LST             oDOT still DeFi + nomination-style
                                    exposure to the staking Service
  (no JAM deposit product)          Optional: DOT/oDOT sleeve to fund
                                    Service deposits / capacity
  Coretime (separate)               Coretime still bought for work;
                                    Orbit is not a coretime marketplace
```

Concrete hooks we **might** build later (each needs its own Service/API — none are Gray Paper primitives Orbit can call today):

1. **Staking-Service adapter** — same deposit → mint oDOT/eDOT flows against the JAM staking Service instead of Hub extrinsics.
2. **Service-deposit sleeve** — if Services require DOT deposits for state/capacity, offer an opt-in path that parks DOT (or oDOT-backed claims) as deposit capital. That is **capacity collateral**, not “restake to secure Service X” unless that Service defines slash conditions.
3. **Operator continuity** — node runners who already use `StakingOperator` with Orbit may run work for JAM-era Services under the same custody split (Orbit holds authority keys; operator runs machines).

### 19.4 What we are not claiming

- Orbit is **not** a JAM client, **PVM** runtime, Refine/Accumulate implementation, or CoreChains Service.
- We are **not** claiming the Gray Paper defines LST restaking or Service security markets.
- Mainnet launch does **not** require JAM to be live.
- eDOT yields in this paper come from **today’s** self-stake incentive pot (DAP), not from hypothetical JAM Service fees or deposits.
- “Waiting for JAM” is explicitly **not** the product thesis (§1).

**Bottom line.** Build liquid nomination + self-stake on Hub now. When JAM lands, Orbit rebinds to the staking Service and may add deposit/capacity products if the economics exist — without making JAM a blocker for Q3 MVP.


## 20. Sources

- Staking Parameter & Budget Configuration Update — Referendum 1909 — [https://polkadot.subsquare.io/referenda/1909](https://polkadot.subsquare.io/referenda/1909)
- Refining Polkadot's Economic Architecture — Parity Technologies — [https://www.parity.io/blog/refining-polkadots-economic-architecture-issuance-DOT-DAP-and-network-adjustments](https://www.parity.io/blog/refining-polkadots-economic-architecture-issuance-DOT-DAP-and-network-adjustments)
- Polkadot's Dynamic Allocation Pool (DAP) — Figment — [https://www.figment.io/insights/polkadots-dynamic-allocation-pool-dap-an-evolution-in-issuance-and-staking/](https://www.figment.io/insights/polkadots-dynamic-allocation-pool-dap-an-evolution-in-issuance-and-staking/)
- Staking Operator Proxy — Polkadot Developer Docs — [https://docs.polkadot.com/node-infrastructure/run-a-validator/operational-tasks/staking-operator-proxy/](https://docs.polkadot.com/node-infrastructure/run-a-validator/operational-tasks/staking-operator-proxy/)
- Polkadot Asset Hub Migration — Figment — [https://www.figment.io/insights/polkadot-asset-hub-migration-what-figment-stakers-need-to-know/](https://www.figment.io/insights/polkadot-asset-hub-migration-what-figment-stakers-need-to-know/)
- "Validators Up 85%, Nominators Down 70%" — Polkadot Forum — [https://forum.polkadot.network/t/validators-up-85-nominators-down-70-staking-rewards/18098](https://forum.polkadot.network/t/validators-up-85-nominators-down-70-staking-rewards/18098)
- Bifrost vDOT / LST penetration reporting — Bifrost blog — [https://bifrost.io/blog/polkadots-inflation-can-bifrost-popularize-dot-liquid-staking](https://bifrost.io/blog/polkadots-inflation-can-bifrost-popularize-dot-liquid-staking)
- JAM Gray Paper (Join-Accumulate Machine) — [https://graypaper.com/](https://graypaper.com/)
- Polkadot Wiki — JAM Chain — [https://wiki.polkadot.com/learn/learn-jam-chain/](https://wiki.polkadot.com/learn/learn-jam-chain/)
- Demystifying JAM — Parity Technologies — [https://www.parity.io/blog/JAM-demystified-explainer](https://www.parity.io/blog/JAM-demystified-explainer)


## Orbit v1 (POC)

### Liquid Staking & Restaking for the Polkadot Ecosystem

Status: Proof of Concept. Not audited. Use at your own risk.

---

### Abstract

Orbit introduces a liquid staking and restaking protocol for the Polkadot ecosystem. While Polkadot’s staking secures the network, it locks DOT, making it unavailable for further use. Orbit v1 solves this inefficiency by issuing a liquid derivative, oDOT, that represents staked DOT. Holders of oDOT can restake to provide additional security for parachains, services, and middleware while earning enhanced yield. Orbit creates capital efficiency, extends shared security, and opens new possibilities for DeFi integration.

---

### Table of Contents

- **1. Introduction**
- **2. Problem Statement**
- **3. The Orbit Solution**
  - 3.1 Liquid Staking
  - 3.2 Restaking
  - 3.3 Benefits
- **4. Technical Architecture**
  - 4.1 System Components
  - 4.2 Reward Mechanism
  - 4.3 Security & Slashing
- **5. Tokenomics**
  - 5.1 oDOT
  - 5.2 Fee Model
- **6. Use Cases**
- **7. Repository Layout**
- **8. Build, Test, and Deploy**
  - 8.1 Prerequisites
  - 8.2 Install
  - 8.3 Test
  - 8.4 Configure Network Keys
  - 8.5 Deploy to Polkadot Asset Hub TestNet (EVM)
  - 8.6 Interact via Console
- **9. Smart Contract APIs**
  - 9.1 ODOT (ERC-20)
  - 9.2 StakingVault
  - 9.3 Events
  - 9.4 Errors
- **10. Math & Accounting**
- **11. Compliance Considerations**
- **12. Roadmap**
- **13. Security, Audits & Disclaimers**
- **14. License**

---

### 1. Introduction

Staking is the foundation of Polkadot’s security model: by locking DOT, validators secure the network and earn rewards. The downside is capital inefficiency: staked assets are illiquid and cannot be reused in DeFi or new protocols.

Liquid staking issues a transferable derivative to keep positions liquid. Restaking extends security to additional services using already staked collateral. Orbit v1 combines both: you can stake DOT to mint oDOT and then restake oDOT for additional rewards.

---

### 2. Problem Statement

- **Capital inefficiency**: a large share of DOT is staked but locked for other uses.
- **Fragmented security**: parachains and services must bootstrap their own validator incentives.
- **Limited yield**: staking yields are modest compared to cross-protocol opportunities.

These limit adoption, liquidity, and composability in the ecosystem.

---

### 3. The Orbit Solution

Orbit v1 introduces a liquid staking + restaking protocol on Polkadot Asset Hub TestNet (EVM), designed to unlock liquidity and expand shared security.

#### 3.1 Liquid Staking

- **Stake** native testnet DOT through the `StakingVault`.
- **Mint** oDOT 1:1 (shares) at the current exchange rate.
- **Unstake** by requesting cooldown and redeeming to native DOT at the current exchange rate.

#### 3.2 Restaking

- **Lock** oDOT in restaking pools to support services/middleware.
- **Earn** additional rewards via a simulated fixed APR per pool in v1 (PoC).
- **Unlock** to realize bonus oDOT shares based on time and pool APR.

#### 3.3 Benefits

- **For users**: higher yield, liquidity, DeFi integrations.
- **For parachains/services**: access to shared security from restakers.
- **For ecosystem**: more efficient capital, greater composability, stronger network effects.

---

### 4. Technical Architecture

#### 4.1 System Components

- **oDOT Token Contract (`contract/contracts/ODOT.sol`)**
  - ERC-20 token minted upon deposit and burned on redemption.
  - Only the `StakingVault` can mint/burn after the vault is set.

- **StakingVault (`contract/contracts/StakingVault.sol`)**
  - Accepts native DOT deposits (payable).
  - Issues oDOT shares at an exchange rate reflecting accrued rewards and fees.
  - Manages cooldown-based unstaking and redemption.
  - Supports restaking pools with extra APR; lockers accrue bonus oDOT shares.
  - Owner controls parameters, pause, and fee collection.

- **Frontend dApp (`frontend/`)**
  - React + TypeScript scaffolding (PoC). Stake, restake, and redeem flows.

#### 4.2 Reward Mechanism

- **Base rewards**: simulated via `baseAprBps` (basis points per year) accruing to the vault’s backing amount (`totalBase`). This increases the oDOT exchange rate over time.
- **Protocol fee**: a share of base rewards (in bps) accrues to `accruedFees` and is withdrawable by the fee recipient.
- **Restaking rewards (v1 PoC)**: per-pool `extraAprBps` mints bonus oDOT shares to lockers upon unlock.

#### 4.3 Security & Slashing

- **Slashing**: the owner can simulate slashing via `slash(amount)`, reducing `totalBase` (affects exchange rate downwards).
- **Pause**: owner can `pause`/`unpause`. When paused, core flows are blocked but `emergencyUnlock` lets users recover escrowed oDOT from locks.
- **Risks**: oDOT inherits base staking risks; restaking introduces proportional penalties in future versions. v2 envisions an insurance pool.

---

### 5. Tokenomics

#### 5.1 oDOT (Orbit DOT)

- **Type**: ERC-20 derivative token (shares-style accounting).
- **Backing**: 1:1 claim on vault’s backing via exchange rate; initial rate 1.0.
- **Utility**: proof of stake participation proxy, DeFi collateral, and restaking.

#### 5.2 Fee Model

- **Protocol fee**: `protocolFeeBps` (default 5%) on base rewards.
- **Recipient**: `feeRecipient` collects via `collectFees`.
- **Staker returns**: net base yield plus restaking bonuses.

---

### 6. Use Cases

- **Yield looping**: stake → receive oDOT → deposit in lending → borrow → stake again.
- **DeFi collateral**: use oDOT in AMMs, stablecoin minting, lending.
- **Shared security**: services and parachains leverage restakers.
- **Risk-mitigated yield (future)**: insurance module to cushion slashing.

---

### 7. Repository Layout

- `contract/` – Hardhat project with Solidity contracts, tests, and deploy script
  - `contracts/ODOT.sol`
  - `contracts/StakingVault.sol`
  - `scripts/deploy.ts`
  - `test/*.test.ts`
- `frontend/` – React + TypeScript dApp (PoC scaffolding)
- `README.md` – this document

---

### 8. Build, Test, and Deploy

#### 8.1 Prerequisites

- Node.js 18+
- pnpm, npm, or yarn
- A funded EVM key for Polkadot Asset Hub TestNet (test DOT)

Network used in this PoC: `polkadotHubTestnet` (Asset Hub EVM)

RPC: `https://testnet-passet-hub-eth-rpc.polkadot.io`

#### 8.2 Install

```bash
cd contract
npm install
```

#### 8.3 Test

```bash
cd contract
npx hardhat test
```

#### 8.4 Configure Network Keys

This Hardhat setup reads the private key from Hardhat vars.

```bash
cd contract
npx hardhat vars set PRIVATE_KEY "0xYOUR_PRIVATE_KEY"
```

Verify `hardhat.config.ts` has `polkadotHubTestnet` configured with `polkavm: true` and the RPC above.

#### 8.5 Deploy to Polkadot Asset Hub TestNet (EVM)

```bash
cd contract
npx hardhat run scripts/deploy.ts --network polkadotHubTestnet
```

The script will:

- Deploy `ODOT` and `StakingVault` with defaults: `BASE_APR_BPS=1000` (10%), `PROTOCOL_FEE_BPS=500` (5%), `COOLDOWN_BLOCKS=600`, `BLOCKS_PER_YEAR=2_102_400`, and `feeRecipient = deployer`.
- Set the vault as the only minter/burner of oDOT via `ODOT.setVault(vaultAddress)`.

Record deployed addresses for the frontend and integrations.

#### 8.6 Interact via Console

```bash
cd contract
npx hardhat console --network polkadotHubTestnet
```

Examples:

```js
// Attach contracts
const [signer] = await ethers.getSigners()
const ODOT = await ethers.getContractFactory("ODOT")
const StakingVault = await ethers.getContractFactory("StakingVault")
const odot = ODOT.attach("0x...ODOT_ADDRESS")
const vault = StakingVault.attach("0x...VAULT_ADDRESS")

// Deposit 1 DOT (in wei units of the chain)
await vault.deposit({ value: ethers.parseUnits("1", 18) })

// Create a restaking pool with 5% extra APR
await vault.createPool(500)

// Lock all oDOT for pool 0
const bal = await odot.balanceOf(await signer.getAddress())
await odot.approve(await vault.getAddress(), bal)
await vault.lock(0, bal)

// Unlock after some blocks to receive bonus shares
await vault.unlock(0)
```

---

### 9. Smart Contract APIs

#### 9.1 ODOT (ERC-20)

File: `contract/contracts/ODOT.sol`

- `constructor()` – sets name `Orbit DOT`, symbol `oDOT`, and owner.
- `setVault(address vault)` – owner-only, callable once; authorizes the vault.
- `mint(address to, uint256 amount)` – vault-only.
- `burn(address from, uint256 amount)` – vault-only.

Standard ERC-20 functions are inherited from OpenZeppelin.

#### 9.2 StakingVault

File: `contract/contracts/StakingVault.sol`

- View/state
  - `exchangeRate() -> uint256` – scaled 1e18; initial 1e18.
  - `liquidity() -> uint256` – native balance held by the vault.
  - `getPoolsLength()`, `getPool(poolId)` – pool introspection.
  - `getUserLocksLength(user)`, `getUserLock(user, index)` – user lock views.
  - `pendingUnstakeOf(user)` – pending request (shares, readyAt).
  - `previewDeposit(amount)`, `previewRedeem(shares)`.

- Admin
  - `setParams(baseAprBps, protocolFeeBps, cooldownBlocks, feeRecipient)`
  - `setBlocksPerYear(blocksPerYear)`
  - `createPool(extraAprBps)`; `setPoolActive(poolId, active)`
  - `collectFees(amount)` – sends fees to recipient (bounded by liquidity)
  - `slash(amount)` – reduces `totalBase` by amount
  - `pause()` / `unpause()`

- Core user flows
  - `deposit()` – payable; mints oDOT shares at current rate
  - `requestUnstake(shares)` – escrows shares, sets cooldown
  - `redeem()` – after cooldown; burns escrowed shares; sends native DOT
  - `cancelUnstake()` – returns escrowed shares, cancels request
  - `lock(poolId, shares)` – escrows shares in a pool
  - `unlock(index)` – returns shares and mints bonus shares if pool APR > 0
  - `emergencyUnlock(index)` – only when paused; returns escrowed shares

#### 9.3 Events

- `Deposited(user, amountIn, sharesOut)`
- `RequestedUnstake(user, shares, readyAt)`
- `Redeemed(user, shares, amountOut)`
- `Locked(user, poolId, shares)` / `Unlocked(user, poolId, shares)`
- `FeesAccrued(amount)` / `FeesCollected(amount)`
- `PoolCreated(poolId, extraAprBps)` / `PoolActiveSet(poolId, active)`
- `ParamsUpdated(...)` / `BlocksPerYearUpdated(...)`
- `Slashed(amount)`

#### 9.4 Errors

Vault uses `require` strings for most checks. ODOT uses custom errors:

- `NotVault()` / `VaultAlreadySet()`

---

### 10. Math & Accounting

- **Exchange rate**: \( rate = \frac{totalBase}{totalShares} \), scaled by 1e18. If `totalShares == 0`, rate is 1e18.
- **Deposit**: mints \( sharesOut = amount \times 1e18 / rate \). Increases `totalBase` by `amount` and `totalShares` by `sharesOut`.
- **Base rewards accrual** (approx.): for elapsed blocks \(\Delta b\), \( gross = totalBase \times baseAprBps/10000 \times \Delta b/blocksPerYear \). Fees are `protocolFeeBps` of `gross`; net increases `totalBase`.
- **Restaking bonuses**: upon unlock, compute base-equivalent \( baseEq = shares \times rate / 1e18 \). Bonus \( gross = baseEq \times extraAprBps/10000 \times \Delta b/blocksPerYear \). Mint bonus shares \( bonusShares = gross \times 1e18 / rate \).
- **Slashing**: decreases `totalBase` directly; reduces the exchange rate for all.

---

### 11. Compliance Considerations

- Staking derivatives may fall under financial regulations.
- Best-practice KYC/AML is recommended for institutional integrations.
- Non-custodial design: users retain asset ownership; contracts are upgrade-free in this PoC.

---

### 12. Roadmap

| Phase | Milestone | Details |
|---|---|---|
| v1 (PoC) | Liquid staking + restaking | Staking contract, oDOT token, restaking simulation on Polkadot Asset Hub TestNet |
| v2 | Governance & Insurance | DAO parameters; insurance pool for slashing |
| v3 | Multi-Parachain Restaking | Multiple parachains and middleware support |
| v4 | Cross-Chain Restaking | XCM + cross-chain messaging for multi-chain restaking |

---

### 13. Security, Audits & Disclaimers

- PoC code. No external audits yet.
- Uses OpenZeppelin libraries for token and access control.
- Owner privileges exist (set params, pause, fees, slashing). Treat deployer as trusted in PoC.
- Do not deploy to mainnet without professional audits and hardened processes.

---

### 14. License

SPDX-License-Identifier: MIT. See headers in Solidity sources.

---

### Quick Links

- `contract/contracts/ODOT.sol`
- `contract/contracts/StakingVault.sol`
- `contract/scripts/deploy.ts`
- Hardhat config: `contract/hardhat.config.ts`


---

### V1 PoC vs V2+ Plan (Mapping and Terminology)

- **V1 (this repo)**: Minimal PoC on Polkadot Asset Hub EVM using Solidity.
  - oDOT (ERC-20 shares) = PoC liquid staking token
  - Simulated base APR and restaking APR inside `StakingVault`
  - No governance token, no XCM, no on-chain validator oracle
- **V2+ (vision)**: Polkadot-native stack with Substrate/Ink!, validator oracle, XCM routing, and broader integrations.
  - stDOT = production liquid staking token (maps conceptually to V1 oDOT)
  - rsDOT = restaking derivative minted when committing stDOT to services
  - YL = governance token for parameters, incentives, and treasury

The sections below lay out the full V2+ design and narrative. Use them as the product brief; the PoC demonstrates flows and math end-to-end with simplified components.

---

### Vision (V2+): Detailed Plan

#### Table of Contents

- **Overview: What Is Orbit?**
- **Polkadot and Staking: The Basics**
  - Polkadot: A Network of Connected Blockchains
  - Staking: Earning Rewards by Securing Polkadot
  - Liquid Staking and Restaking: Making Money Work Harder
  - Why Orbit Matters
- **Problems We’re Fixing**
  - Locked Money: Why Staking Freezes Your Funds
  - Scattered Staking: Parachains Don’t Play Nice
  - Validators: Not Reaching Their Full Power
  - Missing Restaking: Polkadot’s Untapped Potential
- **How Orbit Works**
  - The Building Blocks: Pools, Tokens, and More
  - stDOT: Your Liquid Staking Ticket
  - rsDOT: Supercharging Your Earnings
  - Connecting to Polkadot’s System
  - Tech Tools: How We Build It
- **Step-by-Step: Inside Orbit**
  - The System: Pools, Contracts, and Oracles
  - Your Journey: From Depositing to Earning
  - Validators: Their Role and Rewards
  - System Flow (Text Diagram)
  - Token Journey (Text Diagram)
- **Who’s Involved and Why They Benefit**
  - You: The Staker
  - Validators: Network Guardians
  - The Protocol: Orbit’s Engine
  - The Community: Running the Show
  - DeFi Apps: Partners in Profit
- **Money Matters: Tokens and Rewards**
  - YL Token: Your Voice
  - stDOT: Your Flexible Stake
  - rsDOT: Extra Earnings
  - Fees and Rewards: Keeping It Fair
  - How Value Grows
  - Business Model: Simple and Sustainable
- **Staying Safe: Security and Risks**
  - Choosing Validators Wisely
  - Slashing: Risks and Protections
  - Securing the Tech
  - Polkadot’s Strong Foundation
- **Real-Life Uses**
  - DeFi: Lend, Trade, Earn More
  - Moving Money Across Polkadot
  - Securing Tools Like Oracles
  - Helping New Parachains
- **MVP: Minimum Viable Product**
  - MVP Overview: What’s the Goal?
  - Core Features: Keeping It Simple
  - Technical Architecture: Standard Polkadot Build
  - What’s Excluded from the MVP
  - User Experience: How It Works
  - Deployment and Testing
  - Why This MVP Wins
- **Our Plan: What’s Next**
- **Community Power: Governance**
- **Why We’re Different**
  - Other Staking Tools on Polkadot
  - Orbit’s Edge
- **Final Thoughts**
- **Appendices**
  - A. Simple Terms Explained
  - B. Where Our Data Comes From

---

#### Overview: What Is Orbit?

Think of Orbit as a smart bank account for your crypto on Polkadot. You deposit DOT and earn staking rewards while receiving a liquid receipt (stDOT) you can use across DeFi. You can also restake that receipt (rsDOT) to help secure additional services and earn more. As of 2025 (user-provided figures), tens of billions in DOT are staked and much of it is idle in DeFi; Orbit unlocks that capital.

- **Key benefits**
  - Freedom: Use staked funds in DeFi without waiting for unbonding.
  - More money: Base staking yield plus restaking yield.
  - Safety: Built on Polkadot’s shared security; conservative limits.
  - Ease: Simple UX across parachains via XCM.

Illustrative 2025 context (user-provided): ~49% of DOT staked (~$5.6B), ~50k stakers; DeFi TVL on Polkadot growing toward ~$100M. Orbit targets unlocking a portion of this idle capital with liquid staking and restaking.

---

#### Polkadot and Staking: The Basics

- **Polkadot**: Layer-0 with a Relay Chain and many parachains (e.g., Acala, Moonbeam, Astar, Phala). XCM enables asset and message movement between them.
- **Staking**: Nominators back validators to secure the network and earn yield. Risks include lockup periods and slashing.
- **Liquid staking & restaking**: Liquid staking issues stDOT to keep capital usable. Restaking commits stDOT again to secure other services, earning additional rewards.
- **Why Orbit matters**: It operationalizes both, tailored for Polkadot’s architecture.

Examples (user-provided):

- Staking yields around 12–15% APR (e.g., 12.16%). Validators typically take a commission; nominators face a 28-day unbonding period.
- Liquid staking lets you hold stDOT while using it in DeFi (e.g., lending for an additional ~5%).
- Restaking can add a further ~5–15% depending on the secured service and risk profile.

---

#### Problems We’re Fixing

- Locked capital due to unbonding periods limiting DeFi use.
- Fragmented security across parachains with separate incentives.
- Validators underutilized beyond Relay Chain duties.
- No restaking layer on Polkadot to aggregate additional security and rewards.

Illustrative market context (user-provided): liquid staking exists (e.g., Bifrost ~$90–100M, Acala ~$19–25M) but a unified restaking marketplace is missing.

---

#### How Orbit Works

- **Building blocks**
  - Staking Pool: pools DOT and nominates validators.
  - Restaking Pool: commits stDOT to services or middleware.
  - Validator Oracle: on-chain/off-chain oracle scores and selects validators.
  - Tokens: stDOT (liquid staking), rsDOT (restaking), YL (governance).
  - DAO: governs parameters, fees, and listings.

- **stDOT**
  - Minted 1:1 on deposit; accrues staking rewards.
  - Usable in DeFi (AMMs, lending, perps) via XCM integrations.

- **rsDOT**
  - Minted when locking stDOT into a restaking pool.
  - Accrues additional rewards from the secured service.

- **Connecting to Polkadot**
  - NPoS-based validator selection via Polkadot.js and/or on-chain pallets.
  - XCM moves assets between parachains.

- **Tech tools**
  - Substrate pallets (staking, balances, governance), Ink! contracts for Polkadot-native logic, Solidity on EVM chains (e.g., Moonbeam) for DeFi integrations.

Notes:

- V1 PoC in this repo demonstrates the flows in Solidity on Asset Hub EVM. V2+ envisions Polkadot-native Ink!/Substrate for staking/restaking core and XCM routing to DeFi.

---

#### Step-by-Step: Inside Orbit

- **System**: parachain pallets + Ink!/Solidity contracts + validator oracle + frontend.
- **User journey**
  1) Stake: deposit DOT, receive stDOT.
  2) Restake: lock stDOT and receive rsDOT.
  3) Use DeFi: transfer stDOT via XCM and use in partner apps.
  4) Withdraw: burn rsDOT→stDOT, and stDOT→DOT with unbonding.
- **Validators**: opt-in to restaking tasks and receive extra commissions.
- **Text flow (high-level)**: DOT → staking pool → stDOT → optional restaking (rsDOT) → DeFi via XCM → unwind to redeem DOT.

Token journey example (user-provided):

- Deposit 100 DOT → receive 100 stDOT.
- Restake 50 stDOT to a service → receive 50 rsDOT; total APR could be ~17–27% depending on service.
- Send remaining stDOT to Acala via XCM for lending; borrow aUSD to loop yields.
- To exit: burn rsDOT → stDOT; burn stDOT → start unbonding; withdraw DOT after period.

---

#### Who’s Involved and Why They Benefit

- **Stakers**: flexible yield (staking + restaking) and governance rights.
- **Validators**: more stake, extra fees, broader role.
- **Protocol**: sustainable fee capture to fund development and insurance.
- **Community**: DAO control of parameters and listings.
- **DeFi apps**: additional liquidity and users.

Examples (user-provided): Acala (lending aUSD), HydraDX (AMM), Moonbeam (EVM apps), Astar (WASM/EVM), Phala (privacy compute).

---

#### Money Matters: Tokens and Rewards

- **YL**: fixed-supply governance token to vote on fees, pools, limits.
- **stDOT**: liquid staking derivative pegged to DOT via redemption.
- **rsDOT**: restaking derivative with incremental yield and risk.
- **Fees and rewards**: configurable; example PoC uses 5% protocol fee on base staking rewards, with future models exploring validator/protocol splits and insurance funding.
- **Business model (illustrative)**: MVP emphasizes user yield with a low fee on staking rewards and zero fee on initial restaking to seed adoption.

Illustrative fee model and examples (user-provided):

- Staking fee: 2% of staking rewards (e.g., 1% validators, 1% treasury). If a staker earns $100 in base rewards, fee is $2; user keeps $98 (~11.9% net APR if base is 12.16%).
- Restaking fee: initially 0% to drive adoption; validators might receive an additional commission (e.g., 3.75%) directly from the service.
- Target: $5–10M TVL as MVP scale; fees help fund operations and an insurance buffer.

---

#### Staying Safe: Security and Risks

- **Validator selection**: weighted by uptime, slashing history, stake, and opt-in restaking.
- **Slashing**: caps per validator and per service; pooled insurance funded by protocol fees in future versions.
- **Tech security**: audits, formal verification, bounties; OpenZeppelin usage for Solidity and Ink! best practices.
- **Polkadot foundation**: shared security and mature tooling.

Validator selection criteria (illustrative, user-provided):

- Uptime >95% (40–50% weight)
- No slashing in last 6 months (30% weight)
- Stake size (20% weight)
- Restaking opt-in (10% weight)

Example scoring formula: Score = 0.4×Uptime% + 0.3×(100 if no slashes) + 0.2×(Stake/10M DOT capped) + 0.1×(100 if restaking).

Risk limits (illustrative): cap per-validator and per-service exposure (e.g., max 20% of a validator’s delegated stake at risk per service); portion of protocol fees funds an insurance pool in future versions.

---

#### Real-Life Uses

- DeFi looping with stDOT, AMM LP, lending/borrowing.
- XCM transfers to DeFi-focused parachains.
- Restaking to secure oracles, data availability, and new parachains.

Examples (user-provided):

- Lend: 100 stDOT on Acala → borrow aUSD → earn ~17% combined APR (12% staking + 5% lending).
- Trade: provide stDOT liquidity on HydraDX; earn swap fees.
- Secure: restake rsDOT to oracle networks (e.g., Chainlink) or Phala’s compute pools; earn additional 5–15%.

---

#### MVP: Minimum Viable Product

- **Goal**: demonstrate liquid staking (stDOT) and a single basic restaking pool (rsDOT optional), plus one DeFi integration via XCM.
- **Core features**: staking pool, simple validator selection, stDOT issuance, optional rsDOT, single-parachain DeFi integration.
- **Architecture**: Substrate pallets + Ink! for core; Solidity for integrations where needed; Polkadot.js API glue.
- **Out of scope**: governance token launch, multi-parachain routing, full restaking marketplace.
- **UX**: connect wallet, deposit, receive stDOT, optional restake, use in DeFi, withdraw with unbonding.
- **Deployment/testing**: stage on testnets; audits as gating.

Illustrative plan (user-provided):

- Testnet MVP in Q4 2025; mainnet target Q1 2026 (subject to change).
- Test XCM bridging to a single DeFi partner (e.g., Acala) with simulated $1–5M TVL.
- Optional rsDOT pilot on a test service (e.g., oracle) before broader rollout.

---

#### Our Plan: What’s Next

- Sequence testnet MVP → mainnet launch → rsDOT expansion → multi-parachain support → broad DeFi partnerships → full DAO control.
- Illustrative milestones (user-provided): Q4 2025 MVP (testnet), Q1 2026 mainnet + rsDOT, Q2 2026 GLMR/ASTR support, Q3 2026 DeFi partnerships and $50M staked, 2027 full community governance.

---

#### Community Power: Governance

- YL DAO governs fees, validator sets, pool listings, insurance parameters.

---

#### Why We’re Different

- First to combine Polkadot-native liquid staking with a restaking layer and cross-parachain DeFi routing.
- Dual-stack strategy (Ink! + Solidity) for maximal compatibility.

Context (user-provided):

- Bifrost: ~$90–100M staked (major share of DOT liquid staking), no restaking layer.
- Acala: ~$19–25M staked with DeFi focus, limited to its parachain.
- Parallel Finance: smaller-scale DOT staking.

---

#### Final Thoughts

Orbit makes Polkadot staking simple, flexible, and rewarding. The PoC demonstrates mechanics; the vision scales to a full restaking marketplace governed by the community.

---

#### Appendices

- **A. Simple Terms**: DOT (Polkadot token), stDOT (liquid stake), rsDOT (restaking), NPoS, XCM, Substrate/Ink!, Polkadot.js.
- **B. Sources**: Polkadot and ecosystem docs, user-provided 2025 market stats, staking dashboards, and whitepapers. Figures are illustrative and may change.



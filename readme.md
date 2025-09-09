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



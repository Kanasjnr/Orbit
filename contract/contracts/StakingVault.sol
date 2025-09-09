// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IODOT {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}


contract StakingVault is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    struct LockPosition {
        uint256 shares;        
        uint256 since;         
        uint256 lastAccrued;   
        uint256 poolId;        
    }

    struct Pool {
        uint256 extraAprBps;   
        bool active;
    }

    // Config
    IODOT public immutable oDOT;
    IERC20 public immutable odotERC20; // ERC20 interface for oDOT transfers
    uint256 public baseAprBps;        // base APR applied to entire vault, in bps
    uint256 public protocolFeeBps;    // fee on rewards, in bps
    address public feeRecipient;      // collects protocol fees in native PAS
    uint256 public cooldownBlocks;    // unstake cooldown
    uint256 public blocksPerYear;     // block count used for APR math
    uint256 public constant MAX_APR_BPS = 5_000;    // 50%
    uint256 public constant MAX_FEE_BPS = 2_000;    // 20%

    // Exchange-rate accounting
    uint256 public totalBase;         // logical total backing PAS under management
    uint256 public totalShares;       // mirror of oDOT total supply used for rate
    uint256 public lastAccrualBlock;  // last block rewards were accrued
    uint256 public accruedFees;       // accrued protocol fees in PAS

    // Restaking pools
    Pool[] public pools;
    mapping(address => LockPosition[]) public userLocks;

    // Unstake requests
    struct UnstakeRequest { uint256 shares; uint256 readyAt; }
    mapping(address => UnstakeRequest) public pendingUnstake;

    // Events
    event Deposited(address indexed user, uint256 amountIn, uint256 sharesOut);
    event RequestedUnstake(address indexed user, uint256 shares, uint256 readyAt);
    event Redeemed(address indexed user, uint256 shares, uint256 amountOut);
    event Locked(address indexed user, uint256 poolId, uint256 shares);
    event Unlocked(address indexed user, uint256 poolId, uint256 shares);
    event Slashed(uint256 amount);
    event FeesAccrued(uint256 amount);
    event FeesCollected(uint256 amount);
    event PoolCreated(uint256 indexed poolId, uint256 extraAprBps);
    event ParamsUpdated(uint256 baseAprBps, uint256 protocolFeeBps, uint256 cooldownBlocks, address feeRecipient);
    event BlocksPerYearUpdated(uint256 blocksPerYear);
    event PoolActiveSet(uint256 indexed poolId, bool active);

    constructor(
        address _oDOT,
        uint256 _baseAprBps,
        uint256 _protocolFeeBps,
        uint256 _cooldownBlocks,
        uint256 _blocksPerYear,
        address _feeRecipient
    ) Ownable(msg.sender) {
        require(_oDOT != address(0) && _feeRecipient != address(0), "zero");
        oDOT = IODOT(_oDOT);
        odotERC20 = IERC20(_oDOT);
        require(_baseAprBps <= MAX_APR_BPS, "apr>cap");
        require(_protocolFeeBps <= MAX_FEE_BPS, "fee>cap");
        baseAprBps = _baseAprBps;
        protocolFeeBps = _protocolFeeBps;
        cooldownBlocks = _cooldownBlocks;
        blocksPerYear = _blocksPerYear;
        feeRecipient = _feeRecipient;
        lastAccrualBlock = block.number;
    }

    // View: exchange rate = totalBase / totalShares (scaled as 1e18)
    function exchangeRate() public view returns (uint256) {
        if (totalShares == 0) return 1e18;
        return (totalBase * 1e18) / totalShares;
    }

    // Admin params
    function setParams(uint256 _baseAprBps, uint256 _protocolFeeBps, uint256 _cooldownBlocks, address _feeRecipient) external onlyOwner {
        require(_baseAprBps <= MAX_APR_BPS, "apr>cap");
        require(_protocolFeeBps <= MAX_FEE_BPS, "fee>cap");
        baseAprBps = _baseAprBps;
        protocolFeeBps = _protocolFeeBps;
        cooldownBlocks = _cooldownBlocks;
        feeRecipient = _feeRecipient;
        emit ParamsUpdated(_baseAprBps, _protocolFeeBps, _cooldownBlocks, _feeRecipient);
    }

    function setBlocksPerYear(uint256 _blocksPerYear) external onlyOwner {
        require(_blocksPerYear > 0, "bpy=0");
        blocksPerYear = _blocksPerYear;
        emit BlocksPerYearUpdated(_blocksPerYear);
    }

    function createPool(uint256 extraAprBps) external onlyOwner returns (uint256 poolId) {
        require(extraAprBps <= MAX_APR_BPS, "apr>cap");
        pools.push(Pool({ extraAprBps: extraAprBps, active: true }));
        poolId = pools.length - 1;
        emit PoolCreated(poolId, extraAprBps);
    }

    function setPoolActive(uint256 poolId, bool active) external onlyOwner {
        pools[poolId].active = active;
        emit PoolActiveSet(poolId, active);
    }

    // Core accrual for base APR; compounding via increasing totalBase
    function _accrueBaseRewards() internal {
        if (block.number == lastAccrualBlock || totalBase == 0 || totalShares == 0) {
            lastAccrualBlock = block.number;
            return;
        }
        uint256 blocksElapsed = block.number - lastAccrualBlock;
        // APR per block approximation: reward = base * (aprBps/10000) * (blocks / blocksPerYear)
        uint256 gross = (totalBase * baseAprBps * blocksElapsed) / 10_000 / blocksPerYear;
        if (gross > 0) {
            uint256 fee = (gross * protocolFeeBps) / 10_000;
            uint256 net = gross - fee;
            totalBase += net;
            if (fee > 0) {
                accruedFees += fee;
                emit FeesAccrued(fee);
            }
        }
        lastAccrualBlock = block.number;
    }

    // Deposit PAS → mint shares 1:1 at current rate
    function deposit() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "value=0");
        _accrueBaseRewards();

        totalBase += msg.value;

        uint256 rate = exchangeRate();
        uint256 sharesOut = (msg.value * 1e18) / rate;
        totalShares += sharesOut;
        oDOT.mint(msg.sender, sharesOut);
        emit Deposited(msg.sender, msg.value, sharesOut);
    }

    // Request unstake: escrow shares and start cooldown
    function requestUnstake(uint256 shares) external nonReentrant whenNotPaused {
        require(shares > 0, "shares=0");
        _accrueBaseRewards();
        // escrow user's oDOT to prevent transfer during cooldown
        odotERC20.safeTransferFrom(msg.sender, address(this), shares);
        uint256 readyAt = block.number + cooldownBlocks;
        pendingUnstake[msg.sender] = UnstakeRequest({ shares: shares, readyAt: readyAt });
        emit RequestedUnstake(msg.sender, shares, readyAt);
    }

    // After cooldown, redeem shares for PAS at current rate
    function redeem() external nonReentrant whenNotPaused {
        UnstakeRequest memory req = pendingUnstake[msg.sender];
        require(req.shares > 0, "none");
        require(block.number >= req.readyAt, "cooldown");

        _accrueBaseRewards();

        uint256 rate = exchangeRate();
        uint256 amountOut = (req.shares * rate) / 1e18;
        require(amountOut <= address(this).balance, "liq");

        totalBase -= amountOut;
        // burn escrowed shares now
        oDOT.burn(address(this), req.shares);
        totalShares -= req.shares;
        delete pendingUnstake[msg.sender];
        (bool ok, ) = msg.sender.call{value: amountOut}("");
        require(ok, "send");
        emit Redeemed(msg.sender, req.shares, amountOut);
    }

    function cancelUnstake() external nonReentrant whenNotPaused {
        UnstakeRequest memory req = pendingUnstake[msg.sender];
        require(req.shares > 0, "none");
        delete pendingUnstake[msg.sender];
        // return escrowed shares
        odotERC20.safeTransfer(msg.sender, req.shares);
    }

    // Restaking: lock oDOT shares in a pool to earn extra APR
    function lock(uint256 poolId, uint256 shares) external nonReentrant whenNotPaused {
        require(shares > 0, "shares=0");
        require(poolId < pools.length && pools[poolId].active, "pool");
        // Escrow oDOT shares in the vault
        odotERC20.safeTransferFrom(msg.sender, address(this), shares);

        userLocks[msg.sender].push(LockPosition({
            shares: shares,
            since: block.number,
            lastAccrued: block.number,
            poolId: poolId
        }));
        emit Locked(msg.sender, poolId, shares);
    }

    // Unlock: realize extra APR accrued for the position, then mint bonus shares and return escrow
    function unlock(uint256 index) external nonReentrant whenNotPaused {
        require(index < userLocks[msg.sender].length, "idx");
        _accrueBaseRewards();

        LockPosition memory p = userLocks[msg.sender][index];
        Pool memory pool = pools[p.poolId];

        // compute bonus for lockers only: mint extra shares
        uint256 sharesOut = p.shares;
        uint256 bonusShares = 0;
        if (pool.extraAprBps > 0) {
            uint256 blocksElapsed = block.number - p.lastAccrued;
            if (blocksElapsed > 0) {
                uint256 rateNow = exchangeRate();
                uint256 baseEquivalent = (p.shares * rateNow) / 1e18;
                uint256 gross = (baseEquivalent * pool.extraAprBps * blocksElapsed) / 10_000 / blocksPerYear;
                if (gross > 0) {
                    bonusShares = (gross * 1e18) / rateNow;
                }
            }
        }
        if (bonusShares > 0) {
            totalShares += bonusShares;
            oDOT.mint(msg.sender, bonusShares);
        }
        // return escrowed shares
        odotERC20.safeTransfer(msg.sender, sharesOut);

        // remove lock by swapping with last and popping
        uint256 last = userLocks[msg.sender].length - 1;
        if (index != last) {
            userLocks[msg.sender][index] = userLocks[msg.sender][last];
        }
        userLocks[msg.sender].pop();
        emit Unlocked(msg.sender, p.poolId, sharesOut);
    }

    function slash(uint256 amount) external onlyOwner {
        require(amount > 0 && amount <= totalBase, "invalid");
        totalBase -= amount;
        emit Slashed(amount);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function collectFees(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0 && amount <= accruedFees, "amt");
        uint256 bal = address(this).balance;
        uint256 toSend = amount <= bal ? amount : bal;
        require(toSend > 0, "0");
        accruedFees -= toSend;
        (bool ok, ) = feeRecipient.call{ value: toSend }("");
        require(ok, "send");
        emit FeesCollected(toSend);
    }

    // Emergency: when paused, allow user to retrieve escrowed oDOT without bonus
    function emergencyUnlock(uint256 index) external nonReentrant {
        require(paused(), "not-paused");
        require(index < userLocks[msg.sender].length, "idx");
        LockPosition memory p = userLocks[msg.sender][index];
        odotERC20.safeTransfer(msg.sender, p.shares);
        uint256 last = userLocks[msg.sender].length - 1;
        if (index != last) {
            userLocks[msg.sender][index] = userLocks[msg.sender][last];
        }
        userLocks[msg.sender].pop();
    }

    receive() external payable {
        revert("direct-send");
    }

    // View helpers for frontends
    function getPoolsLength() external view returns (uint256) { return pools.length; }
    function getPool(uint256 poolId) external view returns (uint256 extraAprBps, bool active) {
        Pool memory p = pools[poolId];
        return (p.extraAprBps, p.active);
    }
    function getUserLocksLength(address user) external view returns (uint256) {
        return userLocks[user].length;
    }
    function getUserLock(address user, uint256 index) external view returns (uint256 shares, uint256 since, uint256 lastAccrued, uint256 poolId) {
        LockPosition memory p = userLocks[user][index];
        return (p.shares, p.since, p.lastAccrued, p.poolId);
    }
    function pendingUnstakeOf(address user) external view returns (uint256 shares, uint256 readyAt) {
        UnstakeRequest memory r = pendingUnstake[user];
        return (r.shares, r.readyAt);
    }
    function liquidity() external view returns (uint256) { return address(this).balance; }
    function previewDeposit(uint256 amount) external view returns (uint256 sharesOut) {
        uint256 rate = exchangeRate();
        return (amount * 1e18) / rate;
    }
    function previewRedeem(uint256 shares) external view returns (uint256 amountOut) {
        uint256 rate = exchangeRate();
        return (shares * rate) / 1e18;
    }
}




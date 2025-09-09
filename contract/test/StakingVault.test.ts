import { expect } from "chai"
import hre from "hardhat"

describe("StakingVault", () => {
    let deployer: any
    let user: any
    let other: any

    let odot: any
    let vault: any

    const YEAR_BLOCKS = 1000

    beforeEach(async () => {
        ;[deployer, user, other] = await hre.ethers.getSigners()

        // Deploy ODOT
        const ODOT = await hre.ethers.getContractFactory("ODOT")
        odot = await ODOT.deploy()
        await odot.waitForDeployment()

        // Deploy StakingVault
        const Vault = await hre.ethers.getContractFactory("StakingVault")
        const baseAprBps = 1000 // 10%
        const feeBps = 500 // 5%
        const cooldown = 3n
        const blocksPerYear = YEAR_BLOCKS
        vault = await Vault.deploy(await odot.getAddress(), baseAprBps, feeBps, cooldown, blocksPerYear, deployer.address)
        await vault.waitForDeployment()

        // Set vault as ODOT minter/burner
        await odot.setVault(await vault.getAddress())
    })

    async function mineBlocks(n: number) {
        const hex = "0x" + BigInt(n).toString(16)
        await hre.network.provider.send("hardhat_mine", [hex])
    }

    it("deposit mints shares at initial rate", async () => {
        const amount = hre.ethers.parseUnits("1", 18)
        await vault.deposit({ value: amount })

        const rate = await vault.exchangeRate()
        expect(rate).to.equal(hre.ethers.parseUnits("1", 18))

        const bal = await odot.balanceOf(deployer.address)
        expect(bal).to.equal(amount)
    })

    it("requestUnstake and redeem after cooldown", async () => {
        await vault.setParams(0, 0, 3n, (await hre.ethers.getSigners())[0].address)

        const amount = hre.ethers.parseUnits("2", 18)
        await vault.deposit({ value: amount })

        const shares = await odot.balanceOf(deployer.address)
        await odot.approve(await vault.getAddress(), shares)
        await vault.requestUnstake(shares)

        await mineBlocks(3)

        const liqBefore = await vault.liquidity()
        await vault.redeem()
        const liqAfter = await vault.liquidity()
        expect(liqBefore > liqAfter).to.equal(true)

        const pending = await vault.pendingUnstakeOf(deployer.address)
        expect(pending[0]).to.equal(0n)
    })

    it("lock and unlock mints bonus shares if extra APR set", async () => {
        const amount = hre.ethers.parseUnits("1", 18)
        await vault.deposit({ value: amount })

        await vault.createPool(500)

        const shares = await odot.balanceOf(deployer.address)
        await odot.approve(await vault.getAddress(), shares)
        await vault.lock(0, shares)

        await mineBlocks(10)

        const totalBefore = await odot.totalSupply()
        await vault.unlock(0)
        const totalAfter = await odot.totalSupply()
        expect(totalAfter > totalBefore).to.equal(true)
    })

    it("pause blocks flows and emergencyUnlock works when paused", async () => {
        const amount = hre.ethers.parseUnits("1", 18)
        await vault.deposit({ value: amount })
        await vault.createPool(0)
        const shares = await odot.balanceOf(deployer.address)
        await odot.approve(await vault.getAddress(), shares)
        await vault.lock(0, shares)

        await vault.pause()

        let rev = false
        try {
            await vault.deposit({ value: hre.ethers.parseUnits("1", 18) })
        } catch (e) {
            rev = true
        }
        expect(rev).to.equal(true)

        await vault.emergencyUnlock(0)
        const locksLen = await vault.getUserLocksLength(deployer.address)
        expect(locksLen).to.equal(0n)
    })
})



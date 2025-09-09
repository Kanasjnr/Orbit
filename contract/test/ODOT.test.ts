import { expect } from "chai"
import hre from "hardhat"

describe("ODOT", () => {
    let odot: any
    let deployer: any
    let addr1: any
    let addr2: any

    beforeEach(async () => {
        ;[deployer, addr1, addr2] = await hre.ethers.getSigners()

        const ODOT = await hre.ethers.getContractFactory("ODOT")
        odot = await ODOT.deploy()
        await odot.waitForDeployment()
    })

    it("owner can set vault once", async () => {
        await odot.setVault(addr1.address)
        const vault = await odot.vault()
        expect(vault).to.equal(addr1.address)

        let reverted = false
        try {
            await odot.setVault(addr2.address)
        } catch (e) {
            reverted = true
        }
        expect(reverted).to.equal(true)
    })

    it("non-owner cannot set vault", async () => {
        const odotAsAddr1 = odot.connect(addr1)
        let reverted = false
        try {
            await odotAsAddr1.setVault(addr1.address)
        } catch (e) {
            reverted = true
        }
        expect(reverted).to.equal(true)
    })

    it("only vault can mint and burn", async () => {
        await odot.setVault(addr1.address)

        // non-vault mint reverts
        let revMint = false
        try {
            await odot.mint(addr2.address, hre.ethers.parseUnits("100", 18))
        } catch (e) {
            revMint = true
        }
        expect(revMint).to.equal(true)

        // vault mints
        const odotAsVault = odot.connect(addr1)
        await odotAsVault.mint(addr2.address, hre.ethers.parseUnits("50", 18))
        const balAfterMint = await odot.balanceOf(addr2.address)
        expect(balAfterMint).to.equal(hre.ethers.parseUnits("50", 18))

        // non-vault burn reverts
        let revBurn = false
        try {
            await odot.burn(addr2.address, hre.ethers.parseUnits("10", 18))
        } catch (e) {
            revBurn = true
        }
        expect(revBurn).to.equal(true)

        // vault burns
        await odotAsVault.burn(addr2.address, hre.ethers.parseUnits("10", 18))
        const balAfterBurn = await odot.balanceOf(addr2.address)
        expect(balAfterBurn).to.equal(hre.ethers.parseUnits("40", 18))
    })
})



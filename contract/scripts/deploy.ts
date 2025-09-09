import hre from "hardhat"

async function main() {
    const [deployer] = await hre.ethers.getSigners()
    const deployerAddress = await deployer.getAddress()
    console.log("Deployer:", deployerAddress)

    // Deployment parameters 
    const BASE_APR_BPS = 1000 // 10%
    const PROTOCOL_FEE_BPS = 500 // 5%
    const COOLDOWN_BLOCKS = 600n // blocks
    const BLOCKS_PER_YEAR = 2_102_400 // ~12s block time
    const FEE_RECIPIENT = deployerAddress

    // Deploy ODOT
    const ODOT = await hre.ethers.getContractFactory("ODOT")
    const odot = await ODOT.deploy()
    await odot.waitForDeployment()
    const odotAddress = await odot.getAddress()
    console.log("ODOT deployed:", odotAddress)

    // Deploy StakingVault
    const Vault = await hre.ethers.getContractFactory("StakingVault")
    const vault = await Vault.deploy(
        odotAddress,
        BASE_APR_BPS,
        PROTOCOL_FEE_BPS,
        COOLDOWN_BLOCKS,
        BLOCKS_PER_YEAR,
        FEE_RECIPIENT,
    )
    await vault.waitForDeployment()
    const vaultAddress = await vault.getAddress()
    console.log("StakingVault deployed:", vaultAddress)

    const tx = await odot.setVault(vaultAddress)
    await tx.wait()
    console.log("Vault set in ODOT")

}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})



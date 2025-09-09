require('@nomicfoundation/hardhat-toolbox');


import type { HardhatUserConfig } from "hardhat/config"
import "@parity/hardhat-polkadot"
const { vars } = require('hardhat/config');


const config: HardhatUserConfig = {
    solidity: "0.8.28",
    resolc: {
        // compilerSource: "npm",
        version:"0.3.0"
    },
    networks: {
        // hardhat: {
        //     polkavm: true,
        //     forking: {
        //         url: "https://testnet-passet-hub.polkadot.io",
        //     },
        //     adapterConfig: {
        //         adapterBinaryPath: "./bin/eth-rpc",
        //         dev: true,
        //     },
        // },

         polkadotHubTestnet: {
        polkavm: true,
        url: 'https://testnet-passet-hub-eth-rpc.polkadot.io',
        accounts: [vars.get('PRIVATE_KEY')],
      },
    },
}

export default config

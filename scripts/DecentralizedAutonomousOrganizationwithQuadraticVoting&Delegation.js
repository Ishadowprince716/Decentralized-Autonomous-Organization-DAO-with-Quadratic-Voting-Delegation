// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const { PRIVATE_KEY, CORE_TESTNET_URL, ETHERSCAN_API_KEY } = process.env;

/** 
 * @type import('hardhat/config').HardhatUserConfig 
 */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 500, // Increased for better gas optimization
      },
      viaIR: true, // Use intermediate representation for better compiler optimization
    },
  },

  defaultNetwork: "hardhat",

  networks: {
    hardhat: {
      chainId: 1337,
      blockGasLimit: 12000000,
    },

    // BTCs Core Testnet
    core_testnet2: {
      url: CORE_TESTNET_URL || "https://rpc.test2.btcs.network",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 1115,
      gasPrice: 20_000_000_000,
      timeout: 20000,
    },

    // Example Ethereum Testnet (optional)
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  etherscan: {
    apiKey: ETHERSCAN_API_KEY || "",
  },

  mocha: {
    timeout: 60000, // Increased for complex test cases
    parallel: true,
  },
};

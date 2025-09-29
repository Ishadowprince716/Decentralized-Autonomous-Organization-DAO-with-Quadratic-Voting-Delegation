require("@nomicfoundation/hardhat-toolbox"); // Main toolbox with Ethers, Waffle, etc.
require("dotenv").config();
require("hardhat-contract-sizer"); // Contract size analysis
require("hardhat-gas-reporter"); // Gas usage reporting
require("solidity-coverage"); // Solidity code coverage
require("hardhat-deploy"); // Deployment automation

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    core_testnet2: {
      url: "https://rpc.test2.btcs.network",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1115,
      gasPrice: 20000000000,
    },
    // Add more networks as needed
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 40000,
  },
  contractSizer: {
    runOnCompile: true,
    strict: true,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY || "",
  },
  solidityCoverage: {},
  deploy: {
    // Configuration for hardhat-deploy, if needed
  }
};

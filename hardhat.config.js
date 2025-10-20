require("@nomicfoundation/hardhat-toolbox"); // Main toolbox with Ethers, Waffle, etc.
require("dotenv").config();
require("hardhat-contract-sizer"); // Contract size analysis
require("hardhat-gas-reporter"); // Gas usage reporting
require("solidity-coverage"); // Solidity code coverage
require("hardhat-deploy"); // Deployment automation

// --- Environment Variables Setup ---
// Standard practice to use separate environment variables for RPC URLs and Private Keys
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL || "";
const CORE_TESTNET_RPC_URL = process.env.CORE_TESTNET_RPC_URL || "https://rpc.test2.btcs.network"; // Using ENV for URL as well
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "";
const REPORT_GAS = process.env.REPORT_GAS || false;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  // Set the default network to 'hardhat' if not specified
  defaultNetwork: "hardhat",

  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  // --- Network Configuration ---
  networks: {
    hardhat: {
      chainId: 31337, // Common Hardhat/Localhost chainId
      // You can also fork a live network for testing here:
      // forking: {
      //   url: MAINNET_RPC_URL,
      // },
    },
    // Standard Ethereum Testnet
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY !== "" ? [PRIVATE_KEY] : [],
      chainId: 11155111,
      // gasPrice is often not needed, let Hardhat calculate it
    },
    // Standard Ethereum Mainnet (for verification/deployment testing)
    mainnet: {
      url: MAINNET_RPC_URL,
      accounts: PRIVATE_KEY !== "" ? [PRIVATE_KEY] : [],
      chainId: 1,
    },
    // Existing Core Testnet
    core_testnet2: {
      url: CORE_TESTNET_RPC_URL,
      accounts: PRIVATE_KEY !== "" ? [PRIVATE_KEY] : [],
      chainId: 1115,
      // gasPrice is explicitly defined here as requested, but often auto-calculation is safer
      gasPrice: 20000000000,
    },
  },

  // --- hardhat-deploy configuration ---
  // Mandatory setup for hardhat-deploy scripts
  namedAccounts: {
    deployer: {
      default: 0, // By default, the first account will be the deployer
      1: 0, // On mainnet, the first account is the deployer
      11155111: 0, // On Sepolia, the first account is the deployer
    },
    user1: {
      default: 1, // User 1 is the second account
    },
  },

  // --- Tooling Configuration ---
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./deploy", // Added standard hardhat-deploy folder
    deployments: "./deployments", // Added standard hardhat-deploy output folder
  },

  mocha: {
    timeout: 40000, // Timeout remains 40 seconds
  },

  contractSizer: {
    runOnCompile: true,
    strict: true,
  },

  gasReporter: {
    enabled: REPORT_GAS,
    currency: "USD",
    coinmarketcap: COINMARKETCAP_API_KEY, // Use the variable
    token: "ETH", // Specify token for pricing
    outputFile: "gas-report.txt",
    noColors: true, // Recommended for file output
  },

  solidityCoverage: {},
};

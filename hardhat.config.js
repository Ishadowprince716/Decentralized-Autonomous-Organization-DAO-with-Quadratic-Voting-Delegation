// hardhat.config.js - Updated for ethers v6
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("hardhat-contract-sizer");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("hardhat-deploy");

// Environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const MNEMONIC = process.env.MNEMONIC || "test test test test test test test test test test test junk";

// RPC endpoints
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL || "";
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || "";
const POLYGON_MUMBAI_RPC_URL = process.env.POLYGON_MUMBAI_RPC_URL || "";

// API keys
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "";

// Toggles
const REPORT_GAS = process.env.REPORT_GAS === "true";
const FORKING_ENABLED = process.env.FORKING_ENABLED === "true";
const FORKING_BLOCK_NUMBER = process.env.FORKING_BLOCK_NUMBER ? parseInt(process.env.FORKING_BLOCK_NUMBER) : undefined;

function getAccountsConfig() {
  if (PRIVATE_KEY && PRIVATE_KEY.length > 2) {
    return [PRIVATE_KEY];
  }
  return {
    mnemonic: MNEMONIC,
    path: "m/44'/60'/0'/0",
    initialIndex: 0,
    count: 10,
  };
}

function getNetworkConfig(rpcUrl, chainId, opts = {}) {
  if (!rpcUrl) {
    console.warn(`[hardhat] RPC URL for chainId ${chainId} is empty`);
  }
  return {
    url: rpcUrl || "http://localhost:8545",
    chainId,
    accounts: getAccountsConfig(),
    gasPrice: opts.gasPrice,
    timeout: opts.timeout || 40000,
    ...opts.extra,
  };
}

module.exports = {
  defaultNetwork: "hardhat",
  
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: false,
        },
      },
      {
        version: "0.8.19",
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
    ],
  },

  networks: {
    hardhat: {
      chainId: 31337,
      mining: { auto: true, interval: 0 },
      accounts: {
        mnemonic: MNEMONIC,
        count: 20,
        accountsBalance: "10000000000000000000000",
      },
      allowUnlimitedContractSize: false,
      throwOnTransactionFailures: true,
      throwOnCallFailures: true,
      loggingEnabled: false,
      ...(FORKING_ENABLED && MAINNET_RPC_URL ? {
        forking: {
          url: MAINNET_RPC_URL,
          blockNumber: FORKING_BLOCK_NUMBER,
          enabled: true,
        },
      } : {}),
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      timeout: 60000,
    },
    mainnet: getNetworkConfig(MAINNET_RPC_URL, 1, { extra: { gasMultiplier: 1.2 } }),
    sepolia: getNetworkConfig(SEPOLIA_RPC_URL, 11155111),
    polygon: getNetworkConfig(POLYGON_RPC_URL, 137, { extra: { gasMultiplier: 1.2 } }),
    polygonMumbai: getNetworkConfig(POLYGON_MUMBAI_RPC_URL, 80001),
  },

  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      sepolia: ETHERSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY,
      polygonMumbai: POLYGONSCAN_API_KEY,
    },
  },

  namedAccounts: {
    deployer: { default: 0 },
    user1: { default: 1 },
    user2: { default: 2 },
    treasury: { default: 3 },
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./deploy",
    deployments: "./deployments",
  },

  mocha: {
    timeout: 200000,
    bail: false,
    parallel: false,
  },

  contractSizer: {
    runOnCompile: true,
    strict: true,
    alphaSort: true,
  },

  gasReporter: {
    enabled: REPORT_GAS,
    currency: "USD",
    coinmarketcap: COINMARKETCAP_API_KEY || undefined,
    token: "ETH",
    outputFile: "gas-report.txt",
    noColors: true,
    showTimeSpent: true,
    showMethodSig: true,
    excludeContracts: ["Mock"],
    src: "./contracts",
  },

  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
    alwaysGenerateOverloads: false,
  },
};

// Custom tasks with ethers v6 compatibility
const { task } = require("hardhat/config");

task("accounts", "Prints the list of accounts with balances").setAction(async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  console.log("\nAccounts:");
  console.log("========================================");
  for (const account of accounts) {
    const balance = await hre.ethers.provider.getBalance(account.address);
    console.log(`${account.address}: ${hre.ethers.formatEther(balance)} ETH`);
  }
  console.log("========================================\n");
});

task("block-number", "Prints the current block number").setAction(async (taskArgs, hre) => {
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  console.log(`Current block number: ${blockNumber}`);
});

task("network-info", "Prints network information").setAction(async (taskArgs, hre) => {
  const network = await hre.ethers.provider.getNetwork();
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  const feeData = await hre.ethers.provider.getFeeData();
  console.log("\nNetwork Information:");
  console.log("========================================");
  console.log(`Network Name: ${network.name}");
  console.log(`Chain ID: ${network.chainId}`);
  console.log(`Block Number: ${blockNumber}`);
  console.log(`Gas Price: ${hre.ethers.formatUnits(feeData.gasPrice || 0n, "gwei")} gwei`);
  console.log("========================================\n");
});

console.log("\n✓ Hardhat configuration loaded (ethers v6)");
console.log(`✓ Default network: ${module.exports.defaultNetwork}`);
console.log(`✓ Gas reporting: ${REPORT_GAS ? "enabled" : "disabled"}\n");

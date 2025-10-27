require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("hardhat-contract-sizer");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("hardhat-deploy");
require("@nomiclabs/hardhat-etherscan"); // For contract verification
require("hardhat-tracer"); // For advanced debugging (optional)

// ========================================
// Environment Variables Setup
// ========================================

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const MNEMONIC = process.env.MNEMONIC || "test test test test test test test test test test test junk";

// RPC URLs
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/your-api-key";
const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/your-api-key";
const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL || "https://eth-goerli.g.alchemy.com/v2/your-api-key";
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
const POLYGON_MUMBAI_RPC_URL = process.env.POLYGON_MUMBAI_RPC_URL || "https://rpc-mumbai.maticvigil.com";
const ARBITRUM_RPC_URL = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
const ARBITRUM_GOERLI_RPC_URL = process.env.ARBITRUM_GOERLI_RPC_URL || "https://goerli-rollup.arbitrum.io/rpc";
const OPTIMISM_RPC_URL = process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io";
const OPTIMISM_GOERLI_RPC_URL = process.env.OPTIMISM_GOERLI_RPC_URL || "https://goerli.optimism.io";
const BSC_RPC_URL = process.env.BSC_RPC_URL || "https://bsc-dataseed1.binance.org";
const BSC_TESTNET_RPC_URL = process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";
const AVALANCHE_RPC_URL = process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc";
const AVALANCHE_FUJI_RPC_URL = process.env.AVALANCHE_FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";
const FANTOM_RPC_URL = process.env.FANTOM_RPC_URL || "https://rpc.ftm.tools";
const FANTOM_TESTNET_RPC_URL = process.env.FANTOM_TESTNET_RPC_URL || "https://rpc.testnet.fantom.network";
const CORE_TESTNET_RPC_URL = process.env.CORE_TESTNET_RPC_URL || "https://rpc.test2.btcs.network";
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const BASE_GOERLI_RPC_URL = process.env.BASE_GOERLI_RPC_URL || "https://goerli.base.org";

// API Keys for verification
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY || "";
const OPTIMISTIC_ETHERSCAN_API_KEY = process.env.OPTIMISTIC_ETHERSCAN_API_KEY || "";
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";
const SNOWTRACE_API_KEY = process.env.SNOWTRACE_API_KEY || "";
const FTMSCAN_API_KEY = process.env.FTMSCAN_API_KEY || "";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";

// Other configuration
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "";
const REPORT_GAS = process.env.REPORT_GAS === "true";
const FORKING_ENABLED = process.env.FORKING_ENABLED === "true";
const FORKING_BLOCK_NUMBER = process.env.FORKING_BLOCK_NUMBER ? parseInt(process.env.FORKING_BLOCK_NUMBER) : undefined;

// ========================================
// Helper Functions
// ========================================

/**
 * Get accounts array from private key or mnemonic
 * @param {string} networkName - Name of the network
 * @returns {Array|Object} Accounts configuration
 */
function getAccounts(networkName) {
  if (PRIVATE_KEY && PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    return [PRIVATE_KEY];
  }
  
  // Use mnemonic for local development
  return {
    mnemonic: MNEMONIC,
    path: "m/44'/60'/0'/0",
    initialIndex: 0,
    count: 10,
  };
}

/**
 * Get network configuration
 * @param {string} rpcUrl - RPC URL
 * @param {number} chainId - Chain ID
 * @param {Object} options - Additional options
 * @returns {Object} Network configuration
 */
function getNetworkConfig(rpcUrl, chainId, options = {}) {
  return {
    url: rpcUrl,
    chainId: chainId,
    accounts: getAccounts(options.name || "default"),
    gasPrice: options.gasPrice || "auto",
    gas: options.gas || "auto",
    timeout: options.timeout || 40000,
    ...options.extra,
  };
}

// ========================================
// Hardhat Configuration
// ========================================

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "hardhat",
  
  // ========================================
  // Solidity Compiler Configuration
  // ========================================
  solidity: {
    compilers: [
      {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: false, // Enable for more aggressive optimizations
        },
      },
      // Support for multiple Solidity versions
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },

  // ========================================
  // Network Configuration
  // ========================================
  networks: {
    // Local Development
    hardhat: {
      chainId: 31337,
      mining: {
        auto: true,
        interval: 0, // Mine blocks instantly
      },
      accounts: {
        mnemonic: MNEMONIC,
        count: 20, // More accounts for testing
        accountsBalance: "10000000000000000000000", // 10,000 ETH per account
      },
      allowUnlimitedContractSize: false,
      throwOnTransactionFailures: true,
      throwOnCallFailures: true,
      loggingEnabled: false,
      // Forking configuration
      ...(FORKING_ENABLED && {
        forking: {
          url: MAINNET_RPC_URL,
          blockNumber: FORKING_BLOCK_NUMBER,
          enabled: true,
        },
      }),
    },
    
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      timeout: 60000,
    },

    // ========== Ethereum Networks ==========
    
    mainnet: getNetworkConfig(MAINNET_RPC_URL, 1, {
      name: "mainnet",
      extra: {
        gasMultiplier: 1.2,
      },
    }),
    
    sepolia: getNetworkConfig(SEPOLIA_RPC_URL, 11155111, {
      name: "sepolia",
    }),
    
    goerli: getNetworkConfig(GOERLI_RPC_URL, 5, {
      name: "goerli",
    }),

    // ========== Polygon Networks ==========
    
    polygon: getNetworkConfig(POLYGON_RPC_URL, 137, {
      name: "polygon",
      extra: {
        gasMultiplier: 1.2,
      },
    }),
    
    polygonMumbai: getNetworkConfig(POLYGON_MUMBAI_RPC_URL, 80001, {
      name: "polygonMumbai",
    }),

    // ========== Arbitrum Networks ==========
    
    arbitrum: getNetworkConfig(ARBITRUM_RPC_URL, 42161, {
      name: "arbitrum",
    }),
    
    arbitrumGoerli: getNetworkConfig(ARBITRUM_GOERLI_RPC_URL, 421613, {
      name: "arbitrumGoerli",
    }),

    // ========== Optimism Networks ==========
    
    optimism: getNetworkConfig(OPTIMISM_RPC_URL, 10, {
      name: "optimism",
    }),
    
    optimismGoerli: getNetworkConfig(OPTIMISM_GOERLI_RPC_URL, 420, {
      name: "optimismGoerli",
    }),

    // ========== BSC Networks ==========
    
    bsc: getNetworkConfig(BSC_RPC_URL, 56, {
      name: "bsc",
    }),
    
    bscTestnet: getNetworkConfig(BSC_TESTNET_RPC_URL, 97, {
      name: "bscTestnet",
    }),

    // ========== Avalanche Networks ==========
    
    avalanche: getNetworkConfig(AVALANCHE_RPC_URL, 43114, {
      name: "avalanche",
    }),
    
    avalancheFuji: getNetworkConfig(AVALANCHE_FUJI_RPC_URL, 43113, {
      name: "avalancheFuji",
    }),

    // ========== Fantom Networks ==========
    
    fantom: getNetworkConfig(FANTOM_RPC_URL, 250, {
      name: "fantom",
    }),
    
    fantomTestnet: getNetworkConfig(FANTOM_TESTNET_RPC_URL, 4002, {
      name: "fantomTestnet",
    }),

    // ========== Base Networks ==========
    
    base: getNetworkConfig(BASE_RPC_URL, 8453, {
      name: "base",
    }),
    
    baseGoerli: getNetworkConfig(BASE_GOERLI_RPC_URL, 84531, {
      name: "baseGoerli",
    }),

    // ========== Core Network ==========
    
    core_testnet2: getNetworkConfig(CORE_TESTNET_RPC_URL, 1115, {
      name: "core_testnet2",
      gasPrice: 20000000000,
    }),
  },

  // ========================================
  // Contract Verification (Etherscan)
  // ========================================
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      sepolia: ETHERSCAN_API_KEY,
      goerli: ETHERSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY,
      polygonMumbai: POLYGONSCAN_API_KEY,
      arbitrumOne: ARBISCAN_API_KEY,
      arbitrumGoerli: ARBISCAN_API_KEY,
      optimisticEthereum: OPTIMISTIC_ETHERSCAN_API_KEY,
      optimisticGoerli: OPTIMISTIC_ETHERSCAN_API_KEY,
      bsc: BSCSCAN_API_KEY,
      bscTestnet: BSCSCAN_API_KEY,
      avalanche: SNOWTRACE_API_KEY,
      avalancheFujiTestnet: SNOWTRACE_API_KEY,
      opera: FTMSCAN_API_KEY,
      ftmTestnet: FTMSCAN_API_KEY,
      base: BASESCAN_API_KEY,
      baseGoerli: BASESCAN_API_KEY,
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "baseGoerli",
        chainId: 84531,
        urls: {
          apiURL: "https://api-goerli.basescan.org/api",
          browserURL: "https://goerli.basescan.org",
        },
      },
    ],
  },

  // ========================================
  // Deployment Configuration
  // ========================================
  namedAccounts: {
    deployer: {
      default: 0,
      1: 0, // Mainnet
      5: 0, // Goerli
      11155111: 0, // Sepolia
      137: 0, // Polygon
      80001: 0, // Polygon Mumbai
      42161: 0, // Arbitrum
      10: 0, // Optimism
      56: 0, // BSC
      43114: 0, // Avalanche
      250: 0, // Fantom
      8453: 0, // Base
    },
    user1: {
      default: 1,
    },
    user2: {
      default: 2,
    },
    treasury: {
      default: 3,
    },
    feeCollector: {
      default: 4,
    },
  },

  // ========================================
  // File Paths
  // ========================================
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./deploy",
    deployments: "./deployments",
    imports: "./imports",
  },

  // ========================================
  // Testing Configuration
  // ========================================
  mocha: {
    timeout: 200000, // Increased for complex tests
    bail: false, // Continue running tests after failure
    parallel: false, // Run tests in parallel (set to true for faster execution)
    require: ["hardhat/register"], // Additional test setup
  },

  // ========================================
  // Contract Size Analysis
  // ========================================
  contractSizer: {
    runOnCompile: true,
    strict: true,
    only: [], // Only check specific contracts
    except: [], // Exclude specific contracts
    alphaSort: true,
    disambiguatePaths: false,
  },

  // ========================================
  // Gas Reporter
  // ========================================
  gasReporter: {
    enabled: REPORT_GAS,
    currency: "USD",
    coinmarketcap: COINMARKETCAP_API_KEY,
    token: "ETH",
    gasPriceApi: "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice",
    outputFile: "gas-report.txt",
    noColors: true,
    showTimeSpent: true,
    showMethodSig: true,
    excludeContracts: ["Migrations", "Mock"],
    src: "./contracts",
    // Additional tokens for multi-chain gas reporting
    L1: "ethereum",
    L2: "optimism",
    onlyCalledMethods: true,
  },

  // ========================================
  // Coverage Configuration
  // ========================================
  coverage: {
    skipFiles: ["test/", "mock/", "interfaces/"],
    measureStatementCoverage: true,
    measureFunctionCoverage: true,
    measureBranchCoverage: true,
    measureLineCoverage: true,
  },

  // ========================================
  // External Contracts (for hardhat-deploy)
  // ========================================
  external: {
    contracts: [
      {
        artifacts: "node_modules/@openzeppelin/contracts/build/contracts",
      },
    ],
    deployments: {
      // Import deployments from other networks
      mainnet: ["deployments/mainnet"],
      sepolia: ["deployments/sepolia"],
    },
  },

  // ========================================
  // Typechain Configuration
  // ========================================
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v5",
    alwaysGenerateOverloads: false,
    externalArtifacts: ["externalArtifacts/*.json"],
    dontOverrideCompile: false,
  },

  // ========================================
  // Hardhat Deploy Configuration
  // ========================================
  deploymentMetadata: {
    save: true,
    saveDeployment: true,
  },

  // ========================================
  // Warnings Configuration
  // ========================================
  warnings: {
    "*": {
      "unused-param": "warn",
      "unused-var": "warn",
      default: "error",
    },
  },

  // ========================================
  // Defender Configuration (OpenZeppelin Defender)
  // ========================================
  defender: {
    apiKey: process.env.DEFENDER_API_KEY || "",
    apiSecret: process.env.DEFENDER_API_SECRET || "",
  },
};

// ========================================
// Custom Hardhat Tasks
// ========================================

const { task } = require("hardhat/config");

// Task: Get account balances
task("accounts", "Prints the list of accounts with balances")
  .setAction(async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();
    
    console.log("\nAccounts:");
    console.log("========================================");
    
    for (const account of accounts) {
      const balance = await account.getBalance();
      console.log(
        `${account.address}: ${hre.ethers.utils.formatEther(balance)} ETH`
      );
    }
    console.log("========================================\n");
  });

// Task: Get block number
task("block-number", "Prints the current block number")
  .setAction(async (taskArgs, hre) => {
    const blockNumber = await hre.ethers.provider.getBlockNumber();
    console.log(`Current block number: ${blockNumber}`);
  });

// Task: Get network info
task("network-info", "Prints information about the current network")
  .setAction(async (taskArgs, hre) => {
    const network = await hre.ethers.provider.getNetwork();
    const blockNumber = await hre.ethers.provider.getBlockNumber();
    const gasPrice = await hre.ethers.provider.getGasPrice();
    
    console.log("\nNetwork Information:");
    console.log("========================================");
    console.log(`Network Name: ${network.name}`);
    console.log(`Chain ID: ${network.chainId}`);
    console.log(`Block Number: ${blockNumber}`);
    console.log(`Gas Price: ${hre.ethers.utils.formatUnits(gasPrice, "gwei")} gwei`);
    console.log("========================================\n");
  });

// Task: Clean artifacts and cache
task("clean-all", "Cleans artifacts, cache, and deployments")
  .setAction(async (taskArgs, hre) => {
    await hre.run("clean");
    console.log("Cleaned artifacts and cache");
    
    const fs = require("fs");
    const path = require("path");
    
    const deploymentsPath = path.join(__dirname, "deployments");
    if (fs.existsSync(deploymentsPath)) {
      fs.rmSync(deploymentsPath, { recursive: true, force: true });
      console.log("Cleaned deployments");
    }
    
    console.log("All clean tasks completed");
  });

// Task: Deploy all contracts
task("deploy-all", "Deploy all contracts to the specified network")
  .setAction(async (taskArgs, hre) => {
    console.log(`\nDeploying to ${hre.network.name}...`);
    await hre.run("deploy");
    console.log("Deployment completed\n");
  });

// Task: Verify all deployed contracts
task("verify-all", "Verify all deployed contracts")
  .setAction(async (taskArgs, hre) => {
    const deployments = await hre.deployments.all();
    
    console.log("\nVerifying contracts...");
    console.log("========================================");
    
    for (const [name, deployment] of Object.entries(deployments)) {
      try {
        console.log(`Verifying ${name}...`);
        await hre.run("verify:verify", {
          address: deployment.address,
          constructorArguments: deployment.args || [],
        });
        console.log(`✓ ${name} verified`);
      } catch (error) {
        console.log(`✗ ${name} verification failed: ${error.message}`);
      }
    }
    
    console.log("========================================\n");
  });

// Task: Export deployment addresses
task("export-addresses", "Export deployed contract addresses to JSON")
  .setAction(async (taskArgs, hre) => {
    const deployments = await hre.deployments.all();
    const fs = require("fs");
    const path = require("path");
    
    const addresses = {};
    for (const [name, deployment] of Object.entries(deployments)) {
      addresses[name] = deployment.address;
    }
    
    const outputPath = path.join(__dirname, "deployed-addresses.json");
    fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));
    
    console.log(`Addresses exported to ${outputPath}`);
  });

// Task: Check contract size
task("check-size", "Check if contracts are within size limits")
  .setAction(async (taskArgs, hre) => {
    await hre.run("size-contracts");
  });

// Task: Generate deployment report
task("deployment-report", "Generate a comprehensive deployment report")
  .setAction(async (taskArgs, hre) => {
    const deployments = await hre.deployments.all();
    
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║            DEPLOYMENT REPORT                               ║");
    console.log("╠════════════════════════════════════════════════════════════╣");
    console.log(`║ Network: ${hre.network.name.padEnd(49)}║`);
    console.log(`║ Total Contracts: ${Object.keys(deployments).length.toString().padEnd(43)}║`);
    console.log("╠════════════════════════════════════════════════════════════╣");
    
    for (const [name, deployment] of Object.entries(deployments)) {
      console.log(`║ ${name.padEnd(58)}║`);
      console.log(`║   Address: ${deployment.address.padEnd(47)}║`);
      if (deployment.receipt) {
        console.log(`║   Gas Used: ${deployment.receipt.gasUsed.toString().padEnd(46)}║`);
      }
      console.log("╠════════════════════════════════════════════════════════════╣");
    }
    
    console.log("╚════════════════════════════════════════════════════════════╝\n");
  });

console.log("\n✓ Hardhat configuration loaded successfully");
console.log(`✓ Default network: ${module.exports.defaultNetwork}`);
console.log(`✓ Gas reporting: ${REPORT_GAS ? "enabled" : "disabled"}`);
console.log(`✓ Forking: ${FORKING_ENABLED ? "enabled" : "disabled"}\n`);

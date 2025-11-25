const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Main deployment script for QuadraticDAO
 * Deploys both the governance token and DAO contract
 */
async function main() {
  console.log("\n🚀 Starting DAO Deployment Process...");
  console.log("=".repeat(60));

  // Get deployment account
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  
  console.log("\n🔑 Deployer Account:", deployer.address);
  console.log("💰 Account Balance:", ethers.formatEther(balance), "ETH");
  
  const network = await ethers.provider.getNetwork();
  console.log("🌐 Network:", network.name);
  console.log("🆔 Chain ID:", network.chainId.toString());
  console.log("=".repeat(60));

  // Check if we have enough balance
  if (balance < ethers.parseEther("0.01")) {
    console.warn("⚠️  Warning: Low balance. Deployment may fail.");
  }

  // ========== STEP 1: Deploy Governance Token ==========
  console.log("\n🪙 Step 1: Deploying Governance Token...");
  
  const tokenName = process.env.TOKEN_NAME || "DAO Governance Token";
  const tokenSymbol = process.env.TOKEN_SYMBOL || "DAOGOV";
  const initialSupply = process.env.INITIAL_SUPPLY || ethers.parseEther("1000000"); // 1M tokens

  console.log("Token Name:", tokenName);
  console.log("Token Symbol:", tokenSymbol);
  console.log("Initial Supply:", ethers.formatEther(initialSupply));

  const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
  
  let govToken;
  try {
    // If GovernanceToken doesn't exist, use MockERC20 for testing
    govToken = await GovernanceToken.deploy(tokenName, tokenSymbol);
    await govToken.waitForDeployment();
  } catch (error) {
    console.log("⚠️  GovernanceToken not found, using MockERC20 for testing");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    govToken = await MockERC20.deploy(tokenName, tokenSymbol);
    await govToken.waitForDeployment();
    
    // Mint initial supply
    const mintTx = await govToken.mint(deployer.address, initialSupply);
    await mintTx.wait();
    console.log("✅ Minted initial supply to deployer");
  }

  const govTokenAddress = await govToken.getAddress();
  console.log("✅ Governance Token deployed at:", govTokenAddress);

  // ========== STEP 2: Deploy DAO Contract ==========
  console.log("\n🏛️ Step 2: Deploying QuadraticDAO Contract...");
  
  const proposalStakeThreshold = process.env.PROPOSAL_THRESHOLD || ethers.parseEther("100");
  console.log("Proposal Stake Threshold:", ethers.formatEther(proposalStakeThreshold), "tokens");

  const QuadraticDAO = await ethers.getContractFactory("QuadraticDAO");
  const dao = await QuadraticDAO.deploy(govTokenAddress, proposalStakeThreshold);
  await dao.waitForDeployment();

  const daoAddress = await dao.getAddress();
  console.log("✅ QuadraticDAO deployed at:", daoAddress);

  // ========== STEP 3: Verify Deployment ==========
  console.log("\n🔍 Step 3: Verifying Deployment...");
  
  const owner = await dao.owner();
  const govTokenInDAO = await dao.govToken();
  const threshold = await dao.proposalStakeThreshold();
  const quorum = await dao.quorumPercentage();

  console.log("✅ DAO Owner:", owner);
  console.log("✅ Governance Token:", govTokenInDAO);
  console.log("✅ Proposal Threshold:", ethers.formatEther(threshold), "tokens");
  console.log("✅ Quorum Percentage:", quorum.toString(), "%");

  if (govTokenInDAO.toLowerCase() !== govTokenAddress.toLowerCase()) {
    throw new Error("❌ Token address mismatch!");
  }

  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error("❌ Owner address mismatch!");
  }

  // ========== STEP 4: Save Deployment Info ==========
  console.log("\n💾 Step 4: Saving Deployment Information...");
  
  const deploymentInfo = {
    network: {
      name: network.name,
      chainId: network.chainId.toString(),
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
    contracts: {
      governanceToken: {
        address: govTokenAddress,
        name: tokenName,
        symbol: tokenSymbol,
      },
      dao: {
        address: daoAddress,
        proposalThreshold: ethers.formatEther(threshold),
        quorumPercentage: quorum.toString(),
      },
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const networkDir = path.join(deploymentsDir, network.name);
  
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  if (!fs.existsSync(networkDir)) {
    fs.mkdirSync(networkDir);
  }

  const deploymentFile = path.join(networkDir, "deployment.json");
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ Deployment info saved to:", deploymentFile);

  // ========== STEP 5: Generate Frontend Config ==========
  console.log("\n🎭 Step 5: Generating Frontend Configuration...");
  
  const frontendConfig = {
    contracts: {
      governanceToken: govTokenAddress,
      dao: daoAddress,
    },
    network: {
      chainId: parseInt(network.chainId.toString()),
      name: network.name,
    },
  };

  const configFile = path.join(__dirname, "..", "frontend-config.json");
  fs.writeFileSync(configFile, JSON.stringify(frontendConfig, null, 2));
  console.log("✅ Frontend config saved to:", configFile);

  // ========== STEP 6: Display Summary ==========
  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEPLOYMENT SUCCESSFUL!");
  console.log("=".repeat(60));
  console.log("\n📋 Deployment Summary:");
  console.log("-".repeat(60));
  console.log("🪙 Governance Token:", govTokenAddress);
  console.log("🏛️ DAO Contract:", daoAddress);
  console.log("🔑 Owner:", owner);
  console.log("🌐 Network:", network.name, "(Chain ID:", network.chainId.toString() + ")");
  console.log("-".repeat(60));

  // ========== STEP 7: Next Steps ==========
  console.log("\n📦 Next Steps:");
  console.log("1. ✅ Verify contracts on explorer (if mainnet/testnet)");
  console.log("   npx hardhat verify --network", network.name, govTokenAddress, `\"${tokenName}\"`, `\"${tokenSymbol}\"`
  );
  console.log("   npx hardhat verify --network", network.name, daoAddress, govTokenAddress, threshold.toString());
  console.log("\n2. ✅ Update frontend with contract addresses");
  console.log("   - Use addresses from frontend-config.json");
  console.log("\n3. ✅ Initialize DAO (if needed)");
  console.log("   - Add initial members");
  console.log("   - Configure governance parameters");
  console.log("\n4. ✅ Test contract functionality");
  console.log("   - Stake tokens");
  console.log("   - Create test proposal");
  console.log("   - Vote and finalize");
  console.log("\n" + "=".repeat(60));

  // ========== STEP 8: Verification Commands ==========
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\n🔍 Verification Commands:");
    console.log("-".repeat(60));
    console.log("\n# Verify Governance Token:");
    console.log(`npx hardhat verify --network ${network.name} ${govTokenAddress} "${tokenName}" "${tokenSymbol}"`);
    console.log("\n# Verify DAO Contract:");
    console.log(`npx hardhat verify --network ${network.name} ${daoAddress} ${govTokenAddress} ${threshold.toString()}`);
    console.log("-".repeat(60));
  }

  return {
    govToken: govTokenAddress,
    dao: daoAddress,
    deploymentInfo,
  };
}

// Error handling
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment Failed!");
    console.error("=".repeat(60));
    console.error("Error:", error.message);
    if (error.stack) {
      console.error("\nStack Trace:");
      console.error(error.stack);
    }
    console.error("=".repeat(60));
    process.exit(1);
  });

module.exports = { main };

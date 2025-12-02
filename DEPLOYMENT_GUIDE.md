# DAO Quadratic Voting - Deployment Guide

## Prerequisites

### Required Software
- Node.js >= 18.0.0
- npm >= 9.0.0
- MetaMask or compatible Web3 wallet
- Git

### Required Accounts
- Ethereum wallet with private key
- RPC endpoint (Infura, Alchemy, or custom)
- Etherscan API key (for verification)
- Testnet ETH/tokens for deployment

---

## Installation

```bash
# Clone repository
git clone https://github.com/your-repo/quadratic-dao.git
cd quadratic-dao

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

---

## Configuration

### Environment Variables

Edit `.env` file:

```bash
# Network Configuration
PRIVATE_KEY="your_private_key_here"
MNEMONIC="your twelve word mnemonic phrase here"

# RPC Endpoints
SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
MAINNET_RPC_URL="https://mainnet.infura.io/v3/YOUR_INFURA_KEY"
POLYGON_RPC_URL="https://polygon-rpc.com"

# API Keys
ETHERSCAN_API_KEY="your_etherscan_api_key"
POLYGONSCAN_API_KEY="your_polygonscan_api_key"

# Optional
REPORT_GAS=true
COINMARKETCAP_API_KEY="your_cmc_api_key"
```

> [!WARNING]
> **Never commit your `.env` file to version control!**
> Add it to `.gitignore` immediately.

---

## Pre-Deployment Testing

### 1. Compile Contracts

```bash
npx hardhat clean
npx hardhat compile
```

**Expected Output:**
```
Compiled 5 Solidity files successfully
```

### 2. Run Tests

```bash
# Run all tests
npx hardhat test

# Run security tests specifically
npx hardhat test test/QuadraticDAO.security.test.js

# Run with gas reporting
REPORT_GAS=true npx hardhat test
```

**Expected:** All tests should pass (50+ tests)

### 3. Check Coverage

```bash
npx hardhat coverage
```

**Target:** >95% coverage

### 4. Check Contract Size

```bash
npx hardhat size-contracts
```

**Limit:** Must be <24KB for deployment

---

## Local Deployment

### Start Local Node

```bash
# Terminal 1
npx hardhat node
```

This starts a local Ethereum network on `http://127.0.0.1:8545`

### Deploy to Local Network

```bash
# Terminal 2
npx hardhat run scripts/deploy.js --network localhost
```

### Test Locally

```bash
# Run integration tests against local deployment
npx hardhat test --network localhost
```

---

## Testnet Deployment (Sepolia)

### 1. Get Testnet ETH

- Visit [Sepolia Faucet](https://sepoliafaucet.com/)
- Enter your wallet address
- Request testnet ETH

### 2. Deploy to Sepolia

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

**Save the output:**
```
Deploying QuadraticDAOImproved...
MockERC20 deployed to: 0x1234...
QuadraticDAOImproved deployed to: 0x5678...
Deployment complete!
```

### 3. Verify on Etherscan

```bash
npx hardhat verify --network sepolia \
  0x5678... \
  "0x1234..." \
  "100000000000000000000"
```

Replace:
- `0x5678...` with DAO contract address
- `0x1234...` with token contract address
- `"100000000000000000000"` with proposal threshold (100 tokens)

### 4. Test on Sepolia

- Visit [Sepolia Etherscan](https://sepolia.etherscan.io/)
- Navigate to your contract
- Use "Write Contract" tab to interact
- Test all functions:
  - ✅ Stake tokens
  - ✅ Create proposal
  - ✅ Vote
  - ✅ Finalize proposal
  - ✅ Pause/unpause (owner only)

### 5. Monitor for 1-2 Weeks

- Watch for unexpected behavior
- Monitor gas costs
- Test edge cases
- Gather community feedback

---

## Mainnet Deployment

> [!CAUTION]
> **DO NOT deploy to mainnet without:**
> - ✅ External security audit
> - ✅ 1-2 weeks of testnet validation
> - ✅ Multi-sig wallet setup
> - ✅ Incident response plan
> - ✅ Insurance/bug bounty program

### Pre-Mainnet Checklist

- [ ] External audit completed
- [ ] All audit findings addressed
- [ ] Testnet validation successful
- [ ] Multi-sig wallet created (3-of-5 recommended)
- [ ] Emergency contacts established
- [ ] Bug bounty program launched
- [ ] Documentation complete
- [ ] Community informed
- [ ] Legal review completed
- [ ] Insurance obtained (if applicable)

### Deployment Steps

```bash
# 1. Final test on mainnet fork
FORKING_ENABLED=true npx hardhat test

# 2. Deploy to mainnet
npx hardhat run scripts/deploy.js --network mainnet

# 3. Verify immediately
npx hardhat verify --network mainnet <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>

# 4. Transfer ownership to multi-sig
# Use Etherscan Write Contract interface
# Call transferOwnership(multisigAddress)
# Multi-sig must call acceptOwnership()
```

### Post-Deployment

1. **Verify Contract**
   - Confirm on Etherscan
   - Check all functions
   - Verify ownership transfer

2. **Set Parameters**
   - Set appropriate quorum (10-20%)
   - Set proposal threshold
   - Configure voting periods

3. **Monitor**
   - Set up alerts (Tenderly, Defender)
   - Monitor transactions
   - Watch for anomalies

4. **Announce**
   - Publish contract address
   - Share documentation
   - Educate community

---

## Deployment Script Example

Create `scripts/deploy.js`:

```javascript
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  
  // Deploy MockERC20 (or use existing token)
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const govToken = await MockERC20.deploy("Governance Token", "GOV");
  await govToken.deployed();
  console.log("MockERC20 deployed to:", govToken.address);
  
  // Deploy QuadraticDAOImproved
  const proposalThreshold = ethers.utils.parseEther("100"); // 100 tokens
  const QuadraticDAO = await ethers.getContractFactory("QuadraticDAOImproved");
  const dao = await QuadraticDAO.deploy(govToken.address, proposalThreshold);
  await dao.deployed();
  console.log("QuadraticDAOImproved deployed to:", dao.address);
  
  // Mint some tokens for testing (testnet only)
  if (network.name !== "mainnet") {
    await govToken.mint(deployer.address, ethers.utils.parseEther("10000"));
    console.log("Minted 10,000 tokens to deployer");
  }
  
  console.log("\nDeployment Summary:");
  console.log("==================");
  console.log("Token:", govToken.address);
  console.log("DAO:", dao.address);
  console.log("Proposal Threshold:", ethers.utils.formatEther(proposalThreshold), "tokens");
  console.log("Owner:", await dao.owner());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

---

## Troubleshooting

### Common Issues

#### 1. "Insufficient funds for gas"
**Solution:** Ensure wallet has enough ETH for gas fees

#### 2. "Nonce too high"
**Solution:** Reset MetaMask account or adjust nonce manually

#### 3. "Contract size exceeds limit"
**Solution:** Enable optimizer in `hardhat.config.js`:
```javascript
solidity: {
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
}
```

#### 4. "Verification failed"
**Solution:** Ensure constructor arguments match exactly:
```bash
npx hardhat verify --constructor-args arguments.js <CONTRACT_ADDRESS>
```

---

## Emergency Procedures

### If Vulnerability Discovered

1. **Immediate Actions:**
   - Call `pause()` from owner account
   - Notify community
   - Assess severity

2. **Investigation:**
   - Analyze attack vector
   - Determine impact
   - Develop fix

3. **Resolution:**
   - Deploy patched contract
   - Migrate funds if necessary
   - Compensate affected users

4. **Post-Mortem:**
   - Document incident
   - Update security practices
   - Improve monitoring

---

## Support

- **Documentation:** [README.md](README.md)
- **Security:** [SECURITY_AUDIT.md](SECURITY_AUDIT.md)
- **Testing:** [TESTING_GUIDE.md](TESTING_GUIDE.md)
- **Issues:** [GitHub Issues](https://github.com/your-repo/issues)

---

*Last Updated: December 2, 2025*

# Decentralized Autonomous Organization (DAO) with Quadratic Voting & Delegation

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/your-repo/quadratic-dao)
[![Network](https://img.shields.io/badge/network-Core%20Testnet%202-green.svg)](#network-configuration)
[![Contract](https://img.shields.io/badge/contract-0xFFBf...874bC-orange.svg)](https://scan.test2.btcs.network/address/0xFFBf051CaD6374c7d2A7C1D0Fff510daD95874bC)

> A sophisticated Decentralized Autonomous Organization revolutionizing governance through quadratic voting and flexible delegation, enabling democratic decision-making while preventing plutocratic control.

![DAO Overview](https://github.com/user-attachments/assets/98897f11-2959-40bd-a8ba-29998b6d4d1a)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Why Quadratic Voting?](#-why-quadratic-voting)
- [Key Features](#-key-features)
- [Quick Start](#-quick-start)
- [Contract Architecture](#️-contract-architecture)
- [Network Configuration](#-network-configuration)
- [Usage Examples](#-usage-examples)
- [Testing](#-testing)
- [Future Roadmap](#-future-roadmap)
- [Contributing](#-contributing)
- [Support](#-support--community)
- [License](#-license)

---

## 🎯 Overview

This project implements a **Decentralized Autonomous Organization (DAO)** that addresses the fundamental challenge of fair governance in blockchain communities. Traditional token-based voting systems suffer from "whale dominance" where large holders unilaterally control decisions. Our solution combines **quadratic voting** with **flexible delegation** to create truly democratic governance.

### The Problem

- 🐋 **Whale Dominance**: Large token holders can override community will
- 😴 **Voter Apathy**: Members lack time or expertise to vote on every proposal
- 💸 **Vote Buying**: Linear voting makes influence cheap to acquire at scale
- ⚖️ **Plutocracy**: Wealth equals power in most governance systems

### Our Solution

- 📐 **Quadratic Voting**: Vote strength = √(credits spent), making manipulation expensive
- 🤝 **Smart Delegation**: Delegate to experts while retaining direct voting rights
- 💰 **Fair Entry**: Square root-based voting power from membership contributions
- 🔒 **Secure Architecture**: Reentrancy protection and comprehensive access controls

---

## 🧮 Why Quadratic Voting?

Quadratic voting is a mathematically optimal voting mechanism that balances between one-person-one-vote and plutocracy.

### How It Works

```
Traditional Voting:     100 tokens = 100 votes
Quadratic Voting:       100 credits = 10 votes (√100)

To double your votes:   Spend 4x the credits
To triple your votes:   Spend 9x the credits
```

### Real-World Impact

| Scenario | Traditional System | Quadratic System |
|----------|-------------------|------------------|
| **Whale with 10,000 tokens** | 10,000 votes | 100 votes |
| **100 members with 100 tokens each** | 10,000 votes total | 1,000 votes total |
| **Cost to dominate** | Linear scaling | Quadratically expensive |

**Result**: In quadratic voting, diverse communities naturally outweigh concentrated wealth.

---

## ✨ Key Features

### 🗳️ Quadratic Voting System
- Vote strength increases with square root of credits spent
- Makes vote buying economically unfeasible at scale
- Flexible participation based on conviction level
- Transparent vote tracking and verification

### 👥 Delegation Mechanism
- Delegate voting power to trusted community members
- Revoke delegation anytime with on-chain transparency
- Delegates accumulate power from multiple delegators
- Hybrid direct/representative democracy model

### 💰 Membership System
- Fair entry through configurable membership fees
- Voting power calculated as √(contribution)
- Complete governance participation rights
- Transparent member tracking and analytics

### 📋 Proposal Management
- Any member can create proposals
- Structured voting periods with clear timelines
- Automatic execution based on voting results
- Complete proposal lifecycle tracking

### 🔒 Security & Optimization
- Reentrancy protection on all state changes
- Role-based access control with modifiers
- Gas-optimized contract design
- Comprehensive input validation

---

## 🚀 Quick Start

### Prerequisites

- Node.js v16+
- MetaMask browser extension
- Core Testnet 2 test tokens ([Get from faucet](https://scan.test2.btcs.network/faucet))

### Installation

```bash
# Clone and install
git clone https://github.com/your-username/quadratic-dao.git
cd quadratic-dao
npm install

# Configure environment
cp .env.example .env
# Add your PRIVATE_KEY to .env
```

### Deploy to Core Testnet 2

```bash
# Compile contracts
npm run compile

# Deploy
npm run deploy

# Verify on explorer
npm run verify
```

### Connect via MetaMask

Add Core Testnet 2 to MetaMask:
- **Network Name**: Core Testnet 2
- **RPC URL**: `https://rpc.test2.btcs.network`
- **Chain ID**: `1115`
- **Symbol**: `CORE`
- **Explorer**: `https://scan.test2.btcs.network`

---

## 🏗️ Contract Architecture

### Core Functions

#### `joinDAO()` - Become a Member
```solidity
function joinDAO() external payable
```
- Pay membership fee to join
- Voting power = √(contribution)
- Instant activation with member benefits

#### `createProposal(string title, string description)` - Start a Vote
```solidity
function createProposal(string memory _title, string memory _description) external
```
- Open to all DAO members
- Automatic ID assignment and metadata
- Fixed voting period starts immediately

#### `castQuadraticVote(uint256 proposalId, uint256 credits, bool support)` - Vote
```solidity
function castQuadraticVote(uint256 _proposalId, uint256 _credits, bool _support) external
```
- Vote strength = √(credits)
- Support or oppose proposals
- Delegation-aware voting
- Transparent on-chain recording

#### `delegateVote(address delegate)` - Delegate Your Power
```solidity
function delegateVote(address _delegate) external
```
- Delegate to trusted representatives
- Revoke anytime by calling with address(0)
- Compound delegation support

### State Structure

```solidity
struct Member {
    bool isMember;              // Membership status
    uint256 contribution;        // Amount contributed
    uint256 votingPower;        // Calculated as √(contribution)
    address delegatedTo;        // Current delegate (if any)
}

struct Proposal {
    string title;               // Proposal title
    string description;         // Detailed description
    address proposer;           // Creator address
    uint256 forVotes;          // Votes in favor
    uint256 againstVotes;      // Votes against
    bool executed;             // Execution status
    uint256 endTime;           // Voting deadline
}
```

---

## 🌐 Network Configuration

### Core Testnet 2 Details

| Parameter | Value |
|-----------|--------|
| **Network Name** | Core Testnet 2 |
| **RPC URL** | `https://rpc.test2.btcs.network` |
| **Chain ID** | `1115` |
| **Currency** | `CORE` |
| **Explorer** | [scan.test2.btcs.network](https://scan.test2.btcs.network) |
| **Faucet** | [Get Test Tokens](https://scan.test2.btcs.network/faucet) |

### Deployed Contract

**Address**: [`0xFFBf051CaD6374c7d2A7C1D0Fff510daD95874bC`](https://scan.test2.btcs.network/address/0xFFBf051CaD6374c7d2A7C1D0Fff510daD95874bC)

- ✅ Verified on Block Explorer
- 📅 Deployed: October 2025
- 📜 License: MIT Open Source

---

## 💻 Usage Examples

### Joining the DAO

```javascript
const dao = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

// Join with 1 CORE
const tx = await dao.joinDAO({ value: ethers.parseEther("1.0") });
await tx.wait();

// Your voting power will be √1 = 1
```

### Creating a Proposal

```javascript
const tx = await dao.createProposal(
    "Increase Marketing Budget",
    "Allocate 10,000 CORE for Q1 marketing initiatives"
);
await tx.wait();
```

### Voting with Quadratic Credits

```javascript
// Spend 16 credits for 4 votes (√16 = 4)
const tx = await dao.castQuadraticVote(
    proposalId,
    16,      // credits
    true     // support = true, oppose = false
);
await tx.wait();
```

### Delegating Your Vote

```javascript
// Delegate to a trusted member
const tx = await dao.delegateVote(trustedMemberAddress);
await tx.wait();

// Revoke delegation
const revokeT = await dao.delegateVote(ethers.ZeroAddress);
await revokeTx.wait();
```

---

## 🧪 Testing

### Run Test Suite

```bash
# All tests
npm test

# With coverage report
npm run test:coverage

# Specific test file
npm test test/DAO.test.js

# Watch mode for development
npm run test:watch
```

### Test Coverage

Our comprehensive test suite covers:
- ✅ Membership registration and validation
- ✅ Quadratic voting calculations
- ✅ Delegation mechanics
- ✅ Proposal lifecycle management
- ✅ Security and access controls
- ✅ Edge cases and error conditions

---

## 🔮 Future Roadmap

### Phase 1: Enhanced Governance (Q1 2026)
- Multi-signature proposal execution
- Proposal categories with specialized voting rules
- Member reputation system
- Time-weighted conviction voting

### Phase 2: Economic Features (Q2 2026)
- Native governance token with staking
- Treasury management and automated yield strategies
- Dynamic fee structures based on participation
- Performance-based delegate rewards

### Phase 3: Scalability (Q3 2026)
- Layer 2 deployment (Polygon, Arbitrum, Optimism)
- State channel voting aggregation
- Cross-chain governance coordination
- Modular plugin architecture

### Phase 4: Advanced Features (Q4 2026)
- Privacy-preserving voting with zero-knowledge proofs
- Ranked choice voting for multi-option decisions
- AI-assisted proposal analysis
- Mobile applications (iOS/Android)

### Long-term Vision
- Cross-chain DAO coordination protocols
- DeFi integration for automated execution
- Oracle integration for real-world data
- Universal governance standards

---

## 🤝 Contributing

We welcome contributions! Here's how to get involved:

### Development Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make changes following our code standards
4. Add comprehensive tests
5. Run test suite: `npm test`
6. Update documentation as needed
7. Submit a pull request with clear description

### Code Standards

- **Smart Contracts**: Follow Solidity best practices and OpenZeppelin patterns
- **JavaScript/TypeScript**: Use ESLint and Prettier configurations
- **Testing**: Maintain >80% code coverage
- **Documentation**: Include JSDoc comments and update README

### Bug Reports

Create detailed issues with:
- Clear problem description
- Steps to reproduce
- Environment details (OS, browser, versions)
- Screenshots or error logs
- Expected vs actual behavior

### Feature Requests

Propose new features with:
- Detailed description and use cases
- User impact assessment
- Implementation considerations
- Potential challenges

---

## 📞 Support & Community

### Get Help

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/your-repo/issues)
- 💬 **Discord**: [Join Community](https://discord.gg/your-server)
- 📧 **Email**: support@your-domain.com
- 📖 **Documentation**: [docs.your-domain.com](https://docs.your-domain.com)

### Stay Connected

- 🐦 **Twitter**: [@QuadraticDAO](https://twitter.com/your-handle)
- 📱 **Telegram**: [Community Chat](https://t.me/your-channel)
- 📰 **Blog**: [Latest Updates](https://blog.your-domain.com)
- 📧 **Newsletter**: [Monthly Updates](https://your-domain.com/newsletter)

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### What This Means

- ✅ Commercial use allowed
- ✅ Modification and distribution permitted
- ✅ Private use enabled
- ❌ No warranty provided
- ❌ No trademark rights included

---

## 🙏 Acknowledgments

Built with support from:

- **Ethereum Foundation** - For pioneering decentralized computing
- **Core Blockchain** - For reliable testnet infrastructure
- **OpenZeppelin** - For security-audited smart contract libraries
- **Quadratic Voting Researchers** - For pioneering fair voting mechanisms
- **Open Source Community** - For tools and inspiration

---

<div align="center">

## 🚀 Built with ❤️ for the Decentralized Future

*Making governance truly democratic, one vote at a time* 🗳️

**[⭐ Star](https://github.com/your-repo/quadratic-dao)** • **[🍴 Fork](https://github.com/your-repo/quadratic-dao/fork)** • **[📝 Contribute](CONTRIBUTING.md)** • **[🐛 Issues](https://github.com/your-repo/issues)**

---

![GitHub stars](https://img.shields.io/github/stars/your-repo/quadratic-dao?style=social)
![GitHub forks](https://img.shields.io/github/forks/your-repo/quadratic-dao?style=social)

**Last Updated**: October 2025 • **Version**: 1.0.0 • **License**: MIT

</div>

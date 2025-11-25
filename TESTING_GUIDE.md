# 🧪 Comprehensive Testing Guide

This guide covers all testing procedures for the Quadratic DAO project.

---

## 📊 Table of Contents

1. [Quick Start](#quick-start)
2. [Smart Contract Testing](#smart-contract-testing)
3. [Backend API Testing](#backend-api-testing)
4. [Integration Testing](#integration-testing)
5. [Security Testing](#security-testing)
6. [Gas Optimization Testing](#gas-optimization-testing)
7. [Continuous Integration](#continuous-integration)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Prerequisites
```bash
# Install dependencies
npm install
cd backend && npm install && cd ..
```

### Run All Tests
```bash
# Smart contract tests
npm test

# Backend tests
cd backend && npm test
```

---

## 📜 Smart Contract Testing

### Test Structure

Our smart contract tests cover:
- ✅ **Deployment** - Contract initialization
- ✅ **Staking** - Token staking mechanisms
- ✅ **Unstaking** - Token withdrawal
- ✅ **Delegation** - Voting power delegation
- ✅ **Proposals** - Proposal lifecycle
- ✅ **Voting** - Quadratic voting mechanics
- ✅ **Admin Functions** - Owner privileges
- ✅ **View Functions** - Read operations

### Running Tests

#### 1. Run All Tests
```bash
npm test
```

#### 2. Run Specific Test File
```bash
npx hardhat test test/QuadraticDAO.test.js
```

#### 3. Run With Gas Reporter
```bash
REPORT_GAS=true npm test
```

#### 4. Generate Coverage Report
```bash
npm run coverage
```

### Test Output Example

```
QuadraticDAO
  Deployment
    ✓ Should set the right owner
    ✓ Should set the right governance token
    ✓ Should set the right proposal stake threshold
    ✓ Should set initial quorum percentage to 10
  Staking
    ✓ Should allow users to stake tokens
    ✓ Should add user as member on first stake
    ✓ Should calculate quadratic voting weight correctly
    ✓ Should revert if staking 0 tokens
  ...

  60 passing (3s)
```

### Coverage Requirements

| Component | Target Coverage | Current |
|-----------|----------------|----------|
| Statements | > 90% | TBD |
| Branches | > 85% | TBD |
| Functions | > 95% | TBD |
| Lines | > 90% | TBD |

### Key Test Scenarios

#### Staking Tests
```javascript
// Test quadratic weight calculation
const stakeAmount = ethers.parseEther("100"); // stake 100 tokens
// Expected weight = sqrt(100 * 10^18) ≈ 10 * 10^9
```

#### Voting Tests
```javascript
// Test voting with delegated weight
await dao.connect(addr1).stake(stakeAmount);
await dao.connect(addr1).vote(proposalId, true);
// Verify vote counted with quadratic weight
```

#### Proposal Tests
```javascript
// Test full proposal lifecycle
1. Create proposal
2. Vote during voting period
3. Finalize after voting period
4. Execute if passed
```

---

## 🔌 Backend API Testing

### Test Structure

Backend tests cover:
- ✅ **Health Checks** - Server status
- ✅ **Proposal Endpoints** - CRUD operations
- ✅ **Voting Endpoints** - Vote submission
- ✅ **Member Endpoints** - Member queries
- ✅ **Delegate Endpoints** - Delegation info
- ✅ **Rate Limiting** - Request throttling
- ✅ **Error Handling** - Error responses

### Running Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test
npm test -- api.test.js

# Watch mode
npm test -- --watch
```

### Test Output Example

```
Backend API Tests
  Health Check
    ✓ should return healthy status
  GET /api/proposals
    ✓ should return list of proposals
    ✓ should return proposals with correct structure
  POST /api/proposals
    ✓ should create a new proposal
    ✓ should return 400 if title is missing
  ...

  25 passing (1s)
```

### API Endpoint Testing

#### Health Check
```bash
curl http://localhost:3000/api/health
```

Expected Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-25T14:00:00.000Z"
}
```

#### Get Proposals
```bash
curl http://localhost:3000/api/proposals
```

#### Create Proposal
```bash
curl -X POST http://localhost:3000/api/proposals \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Proposal",
    "description": "Description here",
    "votingPeriod": 100
  }'
```

#### Cast Vote
```bash
curl -X POST http://localhost:3000/api/votes \
  -H "Content-Type: application/json" \
  -d '{
    "proposalId": 1,
    "support": true,
    "voterAddress": "0x123..."
  }'
```

---

## 🔗 Integration Testing

### Full Workflow Test

```bash
# 1. Deploy contracts
npm run compile
npx hardhat run scripts/deploy.js --network localhost

# 2. Start backend
cd backend
npm start &

# 3. Run integration tests
npm run test:integration
```

### Test Scenarios

#### Scenario 1: New Member Joins and Creates Proposal
```javascript
1. Mint tokens to user
2. Approve DAO contract
3. Stake tokens
4. Verify membership
5. Create proposal
6. Verify proposal created
```

#### Scenario 2: Voting and Finalization
```javascript
1. Multiple members stake tokens
2. Create proposal
3. Members vote during period
4. Move time past voting period
5. Finalize proposal
6. Check if passed
7. Execute proposal
```

#### Scenario 3: Delegation Chain
```javascript
1. User A stakes and delegates to B
2. User B stakes and delegates to C
3. Verify C has combined weight
4. C votes on proposal
5. Verify vote weight is correct
```

---

## 🔐 Security Testing

### Automated Security Audits

#### 1. Slither Analysis
```bash
# Install Slither
pip3 install slither-analyzer

# Run analysis
slither . --filter-paths "node_modules|test"
```

#### 2. Mythril Analysis
```bash
# Install Mythril
pip3 install mythril

# Analyze contract
myth analyze contracts/Decentralized-Autonomous-Organization-DAO-with-Quadratic-Voting-Delegation.sol
```

#### 3. NPM Audit
```bash
npm audit
npm audit fix
```

### Manual Security Checks

#### Reentrancy
- ✅ Check all external calls
- ✅ Verify checks-effects-interactions pattern
- ✅ Test reentrancy scenarios

#### Access Control
- ✅ Test owner-only functions with non-owner
- ✅ Verify role-based permissions
- ✅ Test privilege escalation attempts

#### Integer Overflow/Underflow
- ✅ Test with maximum values
- ✅ Test with zero values
- ✅ Verify SafeMath usage (Solidity 0.8+)

#### Front-Running
- ✅ Test vote submission timing
- ✅ Test proposal creation timing
- ✅ Consider MEV scenarios

### Security Test Checklist

```markdown
- [ ] No critical vulnerabilities in Slither
- [ ] No high-severity issues in Mythril
- [ ] All admin functions have access control
- [ ] All external calls follow checks-effects-interactions
- [ ] Input validation on all public functions
- [ ] No hardcoded credentials or private keys
- [ ] Proper event emission for state changes
- [ ] Gas limits considered for loops
- [ ] Reentrancy guards where needed
- [ ] Time-dependent logic secured
```

---

## ⛽ Gas Optimization Testing

### Gas Reporter

```bash
# Enable gas reporting
REPORT_GAS=true npm test
```

### Gas Report Example

```
·------------------------------------|----------------------------|-------------|-----------------------------·
|  Solc version: 0.8.19              ·  Optimizer enabled: true   ·  Runs: 200  ·  Block limit: 30000000 gas  │
··········································|··········································|······························|········································│
|  Methods                                                                                                            │
····················|····································|······························|······························|········································│
|  Contract      ·  Method             ·  Min        ·  Max        ·  Avg        ·  # calls     ·  usd (avg)  │
····················|····································|······························|······························|······························|········································│
|  QuadraticDAO  ·  stake              ·     80000  ·    110000  ·     95000  ·         50  ·          -  │
····················|····································|······························|······························|······························|········································│
|  QuadraticDAO  ·  vote               ·     60000  ·     85000  ·     72500  ·         30  ·          -  │
····················|····································|······························|······························|······························|········································│
|  QuadraticDAO  ·  createProposal     ·    120000  ·    150000  ·    135000  ·         20  ·          -  │
·------------------------------------|----------------------------|-------------|-----------------------------·
```

### Gas Optimization Tips

1. **Use `memory` instead of `storage`** for temporary variables
2. **Pack structs efficiently** - order by size
3. **Use `calldata` for external functions** when not modifying
4. **Cache array lengths** in loops
5. **Use `unchecked` blocks** for safe arithmetic
6. **Batch operations** when possible

---

## 🔄 Continuous Integration

Our CI/CD pipeline runs automatically on:
- Every push to `main` or `develop`
- Every pull request

### GitHub Actions Workflow

```yaml
- Smart Contract Tests
- Backend API Tests
- Code Quality Checks
- Security Audit
- Gas Reporting
- Build Verification
- Documentation Check
```

### Viewing CI Results

1. Go to repository on GitHub
2. Click "Actions" tab
3. View workflow runs
4. Check individual job logs

---

## 🔧 Troubleshooting

### Common Issues

#### Issue 1: Tests Failing Locally
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Clear Hardhat cache
npx hardhat clean

# Recompile
npm run compile

# Run tests
npm test
```

#### Issue 2: Gas Reporter Not Working
```bash
# Ensure environment variable is set
export REPORT_GAS=true
npm test

# Or inline
REPORT_GAS=true npm test
```

#### Issue 3: Coverage Report Failing
```bash
# Install coverage dependencies
npm install --save-dev solidity-coverage

# Run coverage
npm run coverage
```

#### Issue 4: Backend Tests Failing
```bash
# Navigate to backend
cd backend

# Clean install
rm -rf node_modules package-lock.json
npm install

# Run tests
npm test
```

### Getting Help

- 🐛 **Report Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- 📝 **Documentation**: Check `/docs` folder
- 💬 **Discord**: Join our community
- 📧 **Email**: dev-support@dao-project.com

---

## ✅ Testing Checklist

Before deploying:

```markdown
### Smart Contracts
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Coverage > 80%
- [ ] Gas usage acceptable
- [ ] No security vulnerabilities
- [ ] Contract sizes under limit

### Backend
- [ ] All API tests passing
- [ ] WebSocket tests passing
- [ ] Error handling tested
- [ ] Rate limiting tested

### Integration
- [ ] End-to-end workflows tested
- [ ] Frontend-backend integration tested
- [ ] Contract-backend integration tested

### Documentation
- [ ] README updated
- [ ] API documentation complete
- [ ] Deployment guide updated
- [ ] Testing guide reviewed
```

---

**Last Updated**: November 25, 2025
**Version**: 1.0.0
**Maintained By**: DAO Development Team

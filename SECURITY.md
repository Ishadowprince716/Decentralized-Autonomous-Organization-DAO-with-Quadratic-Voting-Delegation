# Security Policy

## 🔒 Overview

The Quadratic DAO project takes security seriously. We appreciate the security research community's efforts in helping us maintain a secure and reliable platform for decentralized governance.

## 🛡️ Supported Versions

We actively support and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## 🔍 Known Security Considerations

### Smart Contract Security

- **Reentrancy Protection**: The `stake` and `unstake` functions handle external token transfers. While current implementation is safe, consider using OpenZeppelin's `ReentrancyGuard` for additional protection.
- **Integer Arithmetic**: Uses Solidity 0.8.19+ which has built-in overflow protection.
- **Delegation Loops**: Current implementation doesn't prevent delegation loops, but delegators cannot delegate to themselves.
- **Quadratic Voting**: The square root calculation is approximated using the Babylonian method with fixed iterations.

### Potential Attack Vectors

1. **Last-Minute Stake**: Users can stake right before voting to manipulate vote weight
2. **Proposal Spam**: No minimum cooldown between proposal creation
3. **Vote Weight Snapshot**: Current weight is used at vote time (no historical snapshots)

## 🚨 Reporting a Vulnerability

### Where to Report

We strongly encourage you to report security vulnerabilities privately before public disclosure.

**Do NOT create public GitHub issues for security vulnerabilities.**

### Reporting Channels

1. **GitHub Security Advisories** (Preferred)
   - Navigate to the Security tab
   - Click "Report a vulnerability"
   - Provide detailed information

2. **Direct Email**
   - Email: security@quadraticdao.io (Replace with actual email)
   - Subject: "[SECURITY] Vulnerability Report"

3. **Encrypted Communication**
   - PGP Key: [Link to public PGP key]
   - For highly sensitive discoveries

### What to Include

 Please provide:

- **Description**: Clear explanation of the vulnerability
- **Impact**: Potential consequences and severity assessment
- **Reproduction Steps**: Detailed steps to reproduce the issue
- **Proof of Concept**: Code, transaction hashes, or screenshots
- **Suggested Fix**: If you have ideas for remediation
- **Your Contact Info**: For follow-up questions

### Report Template

```markdown
## Vulnerability Summary
[Brief description]

## Severity
- [ ] Critical
- [ ] High  
- [ ] Medium
- [ ] Low

## Affected Component
- [ ] Smart Contract
- [ ] Frontend
- [ ] Backend API
- [ ] Infrastructure

## Steps to Reproduce
1. Step one
2. Step two
3. ...

## Expected vs Actual Behavior
**Expected:** [what should happen]
**Actual:** [what actually happens]

## Proof of Concept
[Code/screenshots/transaction links]

## Impact Assessment
[Describe potential damage]

## Suggested Mitigation
[Your recommendations]
```

## 📅 Response Timeline

We are committed to responding promptly:

| Action | Timeline |
|--------|----------|
| **Initial Response** | Within 48 hours |
| **Severity Assessment** | Within 5 business days |
| **Status Updates** | Every 7 days |
| **Fix Development** | Depends on severity |
| **Public Disclosure** | After fix deployment + 30 days |

### Severity Classification

- **Critical** (Fix within 24-48 hours)
  - Funds can be stolen
  - Contract can be destroyed
  - Voting system can be manipulated

- **High** (Fix within 1 week)
  - Significant impact on functionality
  - Denial of service attacks
  - Authentication bypass

- **Medium** (Fix within 2 weeks)
  - Limited impact
  - Information disclosure
  - Edge case exploits

- **Low** (Fix in next release)
  - Minor issues
  - Best practice violations
  - Documentation errors

## 🎁 Bug Bounty Program

### Rewards

We offer rewards for valid security vulnerabilities:

| Severity | Reward Range |
|----------|-------------|
| **Critical** | $1,000 - $5,000 |
| **High** | $500 - $1,000 |
| **Medium** | $200 - $500 |
| **Low** | $50 - $200 |

*Actual rewards depend on impact, quality of report, and fix complexity.*

### Eligibility

✅ **Eligible:**
- First reporter of a unique vulnerability
- Follows responsible disclosure
- Provides clear reproduction steps
- Allows reasonable time for fixes

❌ **Ineligible:**
- Public disclosure before fix
- Social engineering attacks
- DoS attacks on infrastructure
- Spam or automated scanning
- Known issues already reported

## 🔐 Security Best Practices

### For Users

1. **Wallet Security**
   - Never share private keys
   - Use hardware wallets for large stakes
   - Verify contract addresses before transactions

2. **Transaction Safety**
   - Always check gas limits
   - Verify proposal details before voting
   - Be cautious of phishing attempts

3. **Delegation**
   - Research delegates carefully
   - Monitor delegation changes
   - Understand quadratic voting mechanics

### For Developers

1. **Code Review**
   - All PRs require 2+ reviews
   - Focus on state-changing functions
   - Check for reentrancy vulnerabilities

2. **Testing**
   - Maintain >90% code coverage
   - Include edge cases and attack scenarios
   - Run fuzzing tests regularly

3. **Dependencies**
   - Keep dependencies updated
   - Use only audited libraries
   - Pin exact versions in package.json

## 📜 Audit History

| Date | Auditor | Report | Status |
|------|---------|--------|--------|
| TBD | [Auditor Name] | [Link] | Pending |

*We are planning professional security audits before mainnet deployment.*

## 🔄 Security Updates

Subscribe to security advisories:
- Watch this repository
- Follow [@QuadraticDAO](https://twitter.com/QuadraticDAO)
- Join our [Discord](https://discord.gg/quadraticdao)

## 📞 Security Contact

- **Security Email**: security@quadraticdao.io
- **Lead Security Researcher**: [Name]
- **Response Team**: security-team@quadraticdao.io

## 🙏 Hall of Fame

We thank the following security researchers for responsible disclosure:

<!-- Add researchers here -->
- *No reports yet - be the first!*

## 📚 Additional Resources

- [Smart Contract Security Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [Solidity Security Considerations](https://docs.soliditylang.org/en/latest/security-considerations.html)
- [OpenZeppelin Security](https://docs.openzeppelin.com/contracts/4.x/api/security)
- [Ethereum Smart Contract Security](https://ethereum.org/en/developers/docs/smart-contracts/security/)

---

**Last Updated**: November 19, 2025

**Note**: This security policy is subject to change. Check this file regularly for updates.

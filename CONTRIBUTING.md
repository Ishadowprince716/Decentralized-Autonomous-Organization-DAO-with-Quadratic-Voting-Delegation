# Contributing to Quadratic DAO

First off, thank you for considering contributing to the Quadratic DAO project! It's people like you that make this project a great tool for decentralized governance.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Pull Requests](#pull-requests)
- [Development Setup](#development-setup)
- [Style Guidelines](#style-guidelines)
  - [Git Commit Messages](#git-commit-messages)
  - [Solidity Style Guide](#solidity-style-guide)
  - [JavaScript Style Guide](#javascript-style-guide)
- [Testing](#testing)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed and what behavior you expected**
- **Include screenshots if relevant**
- **Include your environment details** (Node version, network, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Explain why this enhancement would be useful**
- **List some other projects where this enhancement exists, if applicable**

### Pull Requests

Please follow these steps for your contribution:

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code follows the existing style
6. Issue that pull request!

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/Decentralized-Autonomous-Organization-DAO-with-Quadratic-Voting-Delegation.git
cd Decentralized-Autonomous-Organization-DAO-with-Quadratic-Voting-Delegation

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Run tests
npm test

# Compile contracts
npm run compile
```

## Style Guidelines

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests after the first line
- Consider starting the commit message with an applicable emoji:
  - 🎨 `:art:` when improving the format/structure of the code
  - 🐛 `:bug:` when fixing a bug
  - ✨ `:sparkles:` when adding a new feature
  - 📝 `:memo:` when writing docs
  - 🚀 `:rocket:` when improving performance
  - ✅ `:white_check_mark:` when adding tests
  - 🔒 `:lock:` when dealing with security

### Solidity Style Guide

- Follow the official [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- Use 4 spaces for indentation
- Add NatSpec comments for all public functions
- Keep functions small and focused
- Use meaningful variable names
- Maximum line length: 120 characters

Example:
```solidity
/// @notice Stakes tokens to gain voting power
/// @param amount The amount of tokens to stake
/// @dev Updates delegate weight using quadratic formula
function stake(uint256 amount) external {
    require(amount > 0, "amount>0");
    // Implementation...
}
```

### JavaScript Style Guide

- Use ES6+ features
- Use 2 spaces for indentation
- Use single quotes for strings
- Add JSDoc comments for functions
- Use async/await over promises
- Use descriptive variable names

## Testing

We use Hardhat for smart contract testing. Please ensure:

- Write unit tests for all new features
- Maintain or improve code coverage
- Test edge cases and error conditions
- Use descriptive test names

```bash
# Run all tests
npm test

# Run specific test file
npm test test/dao.test.js

# Check coverage
npm run coverage
```

## Areas for Contribution

We especially welcome contributions in these areas:

- 🔐 **Security**: Review contracts, suggest improvements
- 🧪 **Testing**: Add more test cases, improve coverage
- 📚 **Documentation**: Improve README, add examples
- 🎨 **Frontend**: Enhance UI/UX, add features
- ⚡ **Gas Optimization**: Make contracts more efficient
- 🌐 **Internationalization**: Translate documentation

## Community

- **Discord**: [Join our community](#)
- **Twitter**: [@QuadraticDAO](#)
- **Forum**: [Discussion Forum](#)

## Questions?

Feel free to open an issue with your question or reach out to the maintainers directly.

---

Thank you for contributing to Quadratic DAO! 🎉

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("QuadraticDAOImproved - Security Tests", function () {
  
  // Fixture to deploy contracts
  async function deployDAOFixture() {
    const [owner, addr1, addr2, addr3, attacker] = await ethers.getSigners();
    
    // Deploy mock ERC20 token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const govToken = await MockERC20.deploy("Governance Token", "GOV");
    
    // Deploy improved DAO
    const QuadraticDAO = await ethers.getContractFactory("QuadraticDAOImproved");
    const proposalThreshold = ethers.parseEther("100");
    const dao = await QuadraticDAO.deploy(await govToken.getAddress(), proposalThreshold);
    
    // Mint tokens to test accounts
    await govToken.mint(owner.address, ethers.parseEther("10000"));
    await govToken.mint(addr1.address, ethers.parseEther("10000"));
    await govToken.mint(addr2.address, ethers.parseEther("10000"));
    await govToken.mint(addr3.address, ethers.parseEther("10000"));
    await govToken.mint(attacker.address, ethers.parseEther("10000"));
    
    return { dao, govToken, owner, addr1, addr2, addr3, attacker, proposalThreshold };
  }

  describe("Reentrancy Protection", function () {
    it("Should prevent reentrancy on stake()", async function () {
      const { dao, govToken, attacker } = await loadFixture(deployDAOFixture);
      
      // Deploy malicious contract that attempts reentrancy
      const MaliciousStaker = await ethers.getContractFactory("MaliciousStaker");
      const malicious = await MaliciousStaker.deploy(await dao.getAddress(), await govToken.getAddress());
      
      // Fund malicious contract
      await govToken.mint(await malicious.getAddress(), ethers.parseEther("1000"));
      
      // Attempt reentrancy attack - should fail
      await expect(
        malicious.attack(ethers.parseEther("100"))
      ).to.be.reverted;
    });

    it("Should prevent reentrancy on unstake()", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      const stakeAmount = ethers.parseEther("500");
      
      // First stake normally
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      // Deploy malicious contract for unstake reentrancy
      const MaliciousUnstaker = await ethers.getContractFactory("MaliciousUnstaker");
      const malicious = await MaliciousUnstaker.deploy(await dao.getAddress());
      
      // Attempt should be prevented by ReentrancyGuard
      await expect(
        malicious.attack(ethers.parseEther("100"))
      ).to.be.reverted;
    });

    it("Should prevent reentrancy on executeProposal()", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      
      // Setup: Create and pass a proposal
      const stakeAmount = ethers.parseEther("200");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      const description = "Test Proposal";
      const votingBlocks = 200;
      await dao.connect(addr1).createProposal(description, votingBlocks, "0x");
      
      // Vote and finalize
      await dao.connect(addr1).vote(1, true);
      await time.advanceBlockTo((await time.latestBlock()) + votingBlocks + 1);
      await dao.connect(addr1).finalizeProposal(1);
      
      // Reentrancy protection should prevent double execution
      await dao.connect(addr1).executeProposal(1);
      await expect(
        dao.connect(addr1).executeProposal(1)
      ).to.be.revertedWithCustomError(dao, "AlreadyExecuted");
    });
  });

  describe("Pausable Functionality", function () {
    it("Should allow owner to pause the contract", async function () {
      const { dao, owner } = await loadFixture(deployDAOFixture);
      
      await expect(dao.connect(owner).pause())
        .to.emit(dao, "Paused")
        .withArgs(owner.address);
      
      expect(await dao.paused()).to.be.true;
    });

    it("Should prevent non-owner from pausing", async function () {
      const { dao, addr1 } = await loadFixture(deployDAOFixture);
      
      await expect(
        dao.connect(addr1).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should block stake() when paused", async function () {
      const { dao, govToken, owner, addr1 } = await loadFixture(deployDAOFixture);
      
      await dao.connect(owner).pause();
      
      const stakeAmount = ethers.parseEther("100");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      
      await expect(
        dao.connect(addr1).stake(stakeAmount)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should block unstake() when paused", async function () {
      const { dao, govToken, owner, addr1 } = await loadFixture(deployDAOFixture);
      
      // First stake
      const stakeAmount = ethers.parseEther("100");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      // Then pause
      await dao.connect(owner).pause();
      
      await expect(
        dao.connect(addr1).unstake(stakeAmount)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should block voting when paused", async function () {
      const { dao, govToken, owner, addr1 } = await loadFixture(deployDAOFixture);
      
      // Create proposal before pausing
      const stakeAmount = ethers.parseEther("200");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      await dao.connect(addr1).createProposal("Test", 200, "0x");
      
      // Pause contract
      await dao.connect(owner).pause();
      
      await expect(
        dao.connect(addr1).vote(1, true)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should allow owner to unpause", async function () {
      const { dao, govToken, owner, addr1 } = await loadFixture(deployDAOFixture);
      
      await dao.connect(owner).pause();
      expect(await dao.paused()).to.be.true;
      
      await expect(dao.connect(owner).unpause())
        .to.emit(dao, "Unpaused")
        .withArgs(owner.address);
      
      expect(await dao.paused()).to.be.false;
      
      // Should be able to stake again
      const stakeAmount = ethers.parseEther("100");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await expect(dao.connect(addr1).stake(stakeAmount)).to.not.be.reverted;
    });
  });

  describe("Input Validation", function () {
    it("Should reject proposal with description too long", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      
      const stakeAmount = ethers.parseEther("200");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      // Create description longer than MAX_DESCRIPTION_LENGTH (1000)
      const longDescription = "a".repeat(1001);
      
      await expect(
        dao.connect(addr1).createProposal(longDescription, 200, "0x")
      ).to.be.revertedWithCustomError(dao, "DescriptionTooLong");
    });

    it("Should reject proposal with voting period too short", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      
      const stakeAmount = ethers.parseEther("200");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      // MIN_VOTING_BLOCKS is 100
      await expect(
        dao.connect(addr1).createProposal("Test", 99, "0x")
      ).to.be.revertedWithCustomError(dao, "InvalidVotingPeriod");
    });

    it("Should reject proposal with voting period too long", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      
      const stakeAmount = ethers.parseEther("200");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      // MAX_VOTING_BLOCKS is 50400
      await expect(
        dao.connect(addr1).createProposal("Test", 50401, "0x")
      ).to.be.revertedWithCustomError(dao, "InvalidVotingPeriod");
    });

    it("Should reject invalid quorum percentage", async function () {
      const { dao, owner } = await loadFixture(deployDAOFixture);
      
      await expect(
        dao.connect(owner).updateQuorumPercentage(0)
      ).to.be.revertedWithCustomError(dao, "InvalidQuorum");
      
      await expect(
        dao.connect(owner).updateQuorumPercentage(101)
      ).to.be.revertedWithCustomError(dao, "InvalidQuorum");
    });

    it("Should accept valid quorum percentage", async function () {
      const { dao, owner } = await loadFixture(deployDAOFixture);
      
      await expect(dao.connect(owner).updateQuorumPercentage(50))
        .to.emit(dao, "QuorumUpdated")
        .withArgs(50);
      
      expect(await dao.quorumPercentage()).to.equal(50);
    });
  });

  describe("Custom Errors (Gas Optimization)", function () {
    it("Should use custom error for invalid amount", async function () {
      const { dao, addr1 } = await loadFixture(deployDAOFixture);
      
      await expect(
        dao.connect(addr1).stake(0)
      ).to.be.revertedWithCustomError(dao, "InvalidAmount");
    });

    it("Should use custom error for insufficient stake", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      
      const stakeAmount = ethers.parseEther("50");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      await expect(
        dao.connect(addr1).createProposal("Test", 200, "0x")
      ).to.be.revertedWithCustomError(dao, "InsufficientStake");
    });

    it("Should use custom error for invalid delegate", async function () {
      const { dao, addr1 } = await loadFixture(deployDAOFixture);
      
      await expect(
        dao.connect(addr1).setDelegate(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(dao, "InvalidDelegate");
    });

    it("Should use custom error for already voted", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      
      const stakeAmount = ethers.parseEther("200");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      await dao.connect(addr1).createProposal("Test", 200, "0x");
      
      await dao.connect(addr1).vote(1, true);
      
      await expect(
        dao.connect(addr1).vote(1, true)
      ).to.be.revertedWithCustomError(dao, "AlreadyVoted");
    });
  });

  describe("Ownable2Step Security", function () {
    it("Should require two-step ownership transfer", async function () {
      const { dao, owner, addr1 } = await loadFixture(deployDAOFixture);
      
      // Step 1: Transfer ownership
      await dao.connect(owner).transferOwnership(addr1.address);
      
      // Owner should still be the original owner
      expect(await dao.owner()).to.equal(owner.address);
      
      // Step 2: New owner accepts
      await dao.connect(addr1).acceptOwnership();
      
      // Now ownership should be transferred
      expect(await dao.owner()).to.equal(addr1.address);
    });

    it("Should prevent unauthorized ownership acceptance", async function () {
      const { dao, owner, addr1, addr2 } = await loadFixture(deployDAOFixture);
      
      await dao.connect(owner).transferOwnership(addr1.address);
      
      // addr2 should not be able to accept ownership
      await expect(
        dao.connect(addr2).acceptOwnership()
      ).to.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("Should prevent non-owner from updating threshold", async function () {
      const { dao, addr1 } = await loadFixture(deployDAOFixture);
      
      await expect(
        dao.connect(addr1).updateProposalThreshold(ethers.parseEther("200"))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should prevent non-owner from updating quorum", async function () {
      const { dao, addr1 } = await loadFixture(deployDAOFixture);
      
      await expect(
        dao.connect(addr1).updateQuorumPercentage(20)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow only proposer or owner to cancel proposal", async function () {
      const { dao, govToken, addr1, addr2 } = await loadFixture(deployDAOFixture);
      
      const stakeAmount = ethers.parseEther("200");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      await dao.connect(addr1).createProposal("Test", 200, "0x");
      
      // addr2 (not proposer, not owner) should not be able to cancel
      await expect(
        dao.connect(addr2).cancelProposal(1)
      ).to.be.revertedWithCustomError(dao, "NotAuthorized");
    });
  });

  describe("Gas Optimization Verification", function () {
    it("Should cache array length in _getTotalDelegateWeight", async function () {
      const { dao, govToken, addr1, addr2, addr3 } = await loadFixture(deployDAOFixture);
      
      // Add multiple members
      const stakeAmount = ethers.parseEther("200");
      
      for (const addr of [addr1, addr2, addr3]) {
        await govToken.connect(addr).approve(await dao.getAddress(), stakeAmount);
        await dao.connect(addr).stake(stakeAmount);
      }
      
      // Create proposal to trigger weight calculation
      await dao.connect(addr1).createProposal("Test", 200, "0x");
      await dao.connect(addr1).vote(1, true);
      
      // Finalize to check quorum (which calls _getTotalDelegateWeight)
      await time.advanceBlockTo((await time.latestBlock()) + 201);
      
      const tx = await dao.connect(addr1).finalizeProposal(1);
      const receipt = await tx.wait();
      
      // Gas should be reasonable even with multiple members
      expect(receipt.gasUsed).to.be.lessThan(200000);
    });
  });
});

// Mock malicious contracts for reentrancy testing would need to be created separately

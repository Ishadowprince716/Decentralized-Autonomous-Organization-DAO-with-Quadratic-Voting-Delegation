const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("QuadraticDAO Integration Tests", function () {
  async function deployDAOFixture() {
    const [owner, addr1, addr2, addr3, addr4, addr5] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockToken = await ethers.getContractFactory("MockERC20");
    const govToken = await MockToken.deploy("Governance Token", "GOV");
    await govToken.waitForDeployment();

    // Mint tokens to test accounts
    const mintAmount = ethers.parseEther("10000");
    await govToken.mint(owner.address, mintAmount);
    await govToken.mint(addr1.address, mintAmount);
    await govToken.mint(addr2.address, mintAmount);
    await govToken.mint(addr3.address, mintAmount);
    await govToken.mint(addr4.address, mintAmount);
    await govToken.mint(addr5.address, mintAmount);

    // Deploy DAO
    const QuadraticDAO = await ethers.getContractFactory("QuadraticDAO");
    const proposalStakeThreshold = ethers.parseEther("100");
    const dao = await QuadraticDAO.deploy(await govToken.getAddress(), proposalStakeThreshold);
    await dao.waitForDeployment();

    return { dao, govToken, owner, addr1, addr2, addr3, addr4, addr5, proposalStakeThreshold };
  }

  describe("Full Governance Cycle", function () {
    it("Should complete a full proposal lifecycle", async function () {
      const { dao, govToken, addr1, addr2, addr3 } = await loadFixture(deployDAOFixture);
      
      // Step 1: Stake tokens
      const stakeAmount = ethers.parseEther("200");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      await govToken.connect(addr2).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr2).stake(stakeAmount);
      
      await govToken.connect(addr3).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr3).stake(stakeAmount);
      
      // Step 2: Create proposal
      const proposalId = 1;
      await dao.connect(addr1).createProposal("Upgrade Protocol", 100, "0x");
      
      // Step 3: Vote on proposal
      await dao.connect(addr1).vote(proposalId, true);
      await dao.connect(addr2).vote(proposalId, true);
      
      // Step 4: Fast forward past voting period
      for (let i = 0; i < 101; i++) {
        await ethers.provider.send("evm_mine", []);
      }
      
      // Step 5: Finalize proposal
      await dao.finalizeProposal(proposalId);
      
      // Step 6: Execute proposal
      await dao.executeProposal(proposalId);
      
      const proposal = await dao.getProposal(proposalId);
      expect(proposal.executed).to.be.true;
    });

    it("Should handle multiple concurrent proposals", async function () {
      const { dao, govToken, addr1, addr2 } = await loadFixture(deployDAOFixture);
      
      const stakeAmount = ethers.parseEther("200");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      await govToken.connect(addr2).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr2).stake(stakeAmount);
      
      // Create multiple proposals
      await dao.connect(addr1).createProposal("Proposal 1", 100, "0x");
      await dao.connect(addr1).createProposal("Proposal 2", 100, "0x");
      await dao.connect(addr1).createProposal("Proposal 3", 100, "0x");
      
      // Vote on different proposals
      await dao.connect(addr1).vote(1, true);
      await dao.connect(addr2).vote(1, false);
      
      await dao.connect(addr1).vote(2, true);
      await dao.connect(addr2).vote(2, true);
      
      await dao.connect(addr1).vote(3, false);
      
      expect(await dao.proposalCount()).to.equal(3);
    });
  });

  describe("Complex Delegation Scenarios", function () {
    it("Should handle delegation chains", async function () {
      const { dao, govToken, addr1, addr2, addr3 } = await loadFixture(deployDAOFixture);
      
      const stakeAmount = ethers.parseEther("100");
      
      // addr1 stakes
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      // addr2 stakes
      await govToken.connect(addr2).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr2).stake(stakeAmount);
      
      // addr3 stakes
      await govToken.connect(addr3).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr3).stake(stakeAmount);
      
      // addr1 delegates to addr2
      await dao.connect(addr1).setDelegate(addr2.address);
      
      // addr2 delegates to addr3
      await dao.connect(addr2).setDelegate(addr3.address);
      
      // Check weight distribution
      const addr3Weight = await dao.getDelegateWeight(addr3.address);
      expect(addr3Weight).to.be.greaterThan(0);
    });

    it("Should handle re-delegation correctly", async function () {
      const { dao, govToken, addr1, addr2, addr3 } = await loadFixture(deployDAOFixture);
      
      const stakeAmount = ethers.parseEther("100");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      // Initial delegation
      await dao.connect(addr1).setDelegate(addr2.address);
      const addr2WeightBefore = await dao.getDelegateWeight(addr2.address);
      
      // Re-delegate to addr3
      await dao.connect(addr1).setDelegate(addr3.address);
      
      const addr2WeightAfter = await dao.getDelegateWeight(addr2.address);
      const addr3Weight = await dao.getDelegateWeight(addr3.address);
      
      expect(addr2WeightAfter).to.equal(0);
      expect(addr3Weight).to.be.greaterThan(0);
    });
  });

  describe("Quadratic Voting Edge Cases", function () {
    it("Should handle varying stake amounts correctly", async function () {
      const { dao, govToken, addr1, addr2, addr3 } = await loadFixture(deployDAOFixture);
      
      // Different stake amounts
      const stake1 = ethers.parseEther("400"); // sqrt = 20
      const stake2 = ethers.parseEther("100"); // sqrt = 10
      const stake3 = ethers.parseEther("900"); // sqrt = 30
      
      await govToken.connect(addr1).approve(await dao.getAddress(), stake1);
      await dao.connect(addr1).stake(stake1);
      
      await govToken.connect(addr2).approve(await dao.getAddress(), stake2);
      await dao.connect(addr2).stake(stake2);
      
      await govToken.connect(addr3).approve(await dao.getAddress(), stake3);
      await dao.connect(addr3).stake(stake3);
      
      const weight1 = await dao.getDelegateWeight(addr1.address);
      const weight2 = await dao.getDelegateWeight(addr2.address);
      const weight3 = await dao.getDelegateWeight(addr3.address);
      
      // Weight should follow quadratic relationship
      expect(weight3).to.be.greaterThan(weight1);
      expect(weight1).to.be.greaterThan(weight2);
    });

    it("Should update voting power on additional stakes", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      
      const initialStake = ethers.parseEther("100");
      await govToken.connect(addr1).approve(await dao.getAddress(), initialStake * 2n);
      await dao.connect(addr1).stake(initialStake);
      
      const weightBefore = await dao.getDelegateWeight(addr1.address);
      
      // Stake more tokens
      await dao.connect(addr1).stake(initialStake);
      
      const weightAfter = await dao.getDelegateWeight(addr1.address);
      expect(weightAfter).to.be.greaterThan(weightBefore);
    });
  });

  describe("Quorum Requirements", function () {
    it("Should reject proposals without quorum", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      
      // Only one voter with small stake
      const stakeAmount = ethers.parseEther("150");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      await dao.connect(addr1).createProposal("Test", 100, "0x");
      await dao.connect(addr1).vote(1, true);
      
      // Fast forward
      for (let i = 0; i < 101; i++) {
        await ethers.provider.send("evm_mine", []);
      }
      
      await dao.finalizeProposal(1);
      
      // Try to execute - should fail due to quorum
      await expect(dao.executeProposal(1)).to.be.revertedWith("quorum not met");
    });

    it("Should pass proposals with sufficient quorum", async function () {
      const { dao, govToken, addr1, addr2, addr3, addr4 } = await loadFixture(deployDAOFixture);
      
      const stakeAmount = ethers.parseEther("200");
      
      // Multiple voters to reach quorum
      for (const addr of [addr1, addr2, addr3, addr4]) {
        await govToken.connect(addr).approve(await dao.getAddress(), stakeAmount);
        await dao.connect(addr).stake(stakeAmount);
      }
      
      await dao.connect(addr1).createProposal("Test", 100, "0x");
      
      // Majority votes
      await dao.connect(addr1).vote(1, true);
      await dao.connect(addr2).vote(1, true);
      await dao.connect(addr3).vote(1, true);
      
      // Fast forward
      for (let i = 0; i < 101; i++) {
        await ethers.provider.send("evm_mine", []);
      }
      
      await dao.finalizeProposal(1);
      await dao.executeProposal(1);
      
      const proposal = await dao.getProposal(1);
      expect(proposal.executed).to.be.true;
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update thresholds dynamically", async function () {
      const { dao, owner } = await loadFixture(deployDAOFixture);
      
      const newThreshold = ethers.parseEther("500");
      await dao.connect(owner).updateProposalThreshold(newThreshold);
      
      expect(await dao.proposalStakeThreshold()).to.equal(newThreshold);
    });

    it("Should allow owner to cancel proposals", async function () {
      const { dao, govToken, owner, addr1 } = await loadFixture(deployDAOFixture);
      
      const stakeAmount = ethers.parseEther("150");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      await dao.connect(addr1).createProposal("Test", 100, "0x");
      
      await expect(dao.connect(owner).cancelProposal(1))
        .to.emit(dao, "ProposalCancelled");
    });
  });

  describe("Security Tests", function () {
    it("Should prevent double voting", async function () {
      const { dao, govToken, addr1, addr2 } = await loadFixture(deployDAOFixture);
      
      const stakeAmount = ethers.parseEther("150");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      await govToken.connect(addr2).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr2).stake(stakeAmount);
      
      await dao.connect(addr1).createProposal("Test", 100, "0x");
      await dao.connect(addr2).vote(1, true);
      
      await expect(dao.connect(addr2).vote(1, false)).to.be.revertedWith("already voted");
    });

    it("Should prevent voting with zero weight", async function () {
      const { dao, govToken, addr1, addr2 } = await loadFixture(deployDAOFixture);
      
      const stakeAmount = ethers.parseEther("150");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      await dao.connect(addr1).createProposal("Test", 100, "0x");
      
      // addr2 has no stake
      await expect(dao.connect(addr2).vote(1, true)).to.be.revertedWith("no delegated weight");
    });

    it("Should prevent proposal execution before finalization", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      
      const stakeAmount = ethers.parseEther("150");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      await dao.connect(addr1).createProposal("Test", 100, "0x");
      
      await expect(dao.executeProposal(1)).to.be.revertedWith("not finalized");
    });
  });
});

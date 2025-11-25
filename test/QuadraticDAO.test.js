const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("QuadraticDAO", function () {
  // Fixture to deploy contracts
  async function deployDAOFixture() {
    const [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

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

    // Deploy DAO
    const QuadraticDAO = await ethers.getContractFactory("QuadraticDAO");
    const proposalStakeThreshold = ethers.parseEther("100");
    const dao = await QuadraticDAO.deploy(await govToken.getAddress(), proposalStakeThreshold);
    await dao.waitForDeployment();

    return { dao, govToken, owner, addr1, addr2, addr3, addr4, proposalStakeThreshold };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { dao, owner } = await loadFixture(deployDAOFixture);
      expect(await dao.owner()).to.equal(owner.address);
    });

    it("Should set the right governance token", async function () {
      const { dao, govToken } = await loadFixture(deployDAOFixture);
      expect(await dao.govToken()).to.equal(await govToken.getAddress());
    });

    it("Should set the right proposal stake threshold", async function () {
      const { dao, proposalStakeThreshold } = await loadFixture(deployDAOFixture);
      expect(await dao.proposalStakeThreshold()).to.equal(proposalStakeThreshold);
    });

    it("Should set initial quorum percentage to 10", async function () {
      const { dao } = await loadFixture(deployDAOFixture);
      expect(await dao.quorumPercentage()).to.equal(10);
    });
  });

  describe("Staking", function () {
    it("Should allow users to stake tokens", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      const stakeAmount = ethers.parseEther("100");

      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await expect(dao.connect(addr1).stake(stakeAmount))
        .to.emit(dao, "Staked")
        .withArgs(addr1.address, stakeAmount);

      expect(await dao.stakeOf(addr1.address)).to.equal(stakeAmount);
    });

    it("Should add user as member on first stake", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      const stakeAmount = ethers.parseEther("100");

      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);

      expect(await dao.isMember(addr1.address)).to.be.true;
      expect(await dao.totalMembers()).to.equal(1);
    });

    it("Should calculate quadratic voting weight correctly", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      const stakeAmount = ethers.parseEther("100"); // sqrt(100) = 10

      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);

      // Expected weight = sqrt(100 * 10^18) = 10 * 10^9
      const expectedWeight = ethers.parseEther("10");
      const actualWeight = await dao.getDelegateWeight(addr1.address);
      
      // Allow small margin for integer square root approximation
      const diff = actualWeight > expectedWeight ? 
        actualWeight - expectedWeight : 
        expectedWeight - actualWeight;
      expect(diff).to.be.lessThan(ethers.parseEther("0.01"));
    });

    it("Should revert if staking 0 tokens", async function () {
      const { dao, addr1 } = await loadFixture(deployDAOFixture);
      await expect(dao.connect(addr1).stake(0)).to.be.revertedWith("amount>0");
    });

    it("Should revert if token transfer fails", async function () {
      const { dao, addr1 } = await loadFixture(deployDAOFixture);
      const stakeAmount = ethers.parseEther("100");
      
      // Don't approve, so transfer will fail
      await expect(dao.connect(addr1).stake(stakeAmount)).to.be.reverted;
    });
  });

  describe("Unstaking", function () {
    it("Should allow users to unstake tokens", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      const stakeAmount = ethers.parseEther("100");
      const unstakeAmount = ethers.parseEther("50");

      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);

      await expect(dao.connect(addr1).unstake(unstakeAmount))
        .to.emit(dao, "Unstaked")
        .withArgs(addr1.address, unstakeAmount);

      expect(await dao.stakeOf(addr1.address)).to.equal(stakeAmount - unstakeAmount);
    });

    it("Should update delegate weight on unstake", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      const stakeAmount = ethers.parseEther("100");
      const unstakeAmount = ethers.parseEther("75");

      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      const weightBefore = await dao.getDelegateWeight(addr1.address);
      await dao.connect(addr1).unstake(unstakeAmount);
      const weightAfter = await dao.getDelegateWeight(addr1.address);

      expect(weightAfter).to.be.lessThan(weightBefore);
    });

    it("Should revert if unstaking more than staked", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      const stakeAmount = ethers.parseEther("100");

      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);

      await expect(
        dao.connect(addr1).unstake(ethers.parseEther("200"))
      ).to.be.revertedWith("not enough stake");
    });

    it("Should revert if unstaking 0 tokens", async function () {
      const { dao, addr1 } = await loadFixture(deployDAOFixture);
      await expect(dao.connect(addr1).unstake(0)).to.be.revertedWith("amount>0");
    });
  });

  describe("Delegation", function () {
    it("Should allow users to delegate voting power", async function () {
      const { dao, govToken, addr1, addr2 } = await loadFixture(deployDAOFixture);
      const stakeAmount = ethers.parseEther("100");

      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);

      await expect(dao.connect(addr1).setDelegate(addr2.address))
        .to.emit(dao, "Delegated")
        .withArgs(addr1.address, addr1.address, addr2.address);

      expect(await dao.delegateOf(addr1.address)).to.equal(addr2.address);
    });

    it("Should transfer voting weight on delegation", async function () {
      const { dao, govToken, addr1, addr2 } = await loadFixture(deployDAOFixture);
      const stakeAmount = ethers.parseEther("100");

      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);

      const addr1WeightBefore = await dao.getDelegateWeight(addr1.address);
      const addr2WeightBefore = await dao.getDelegateWeight(addr2.address);

      await dao.connect(addr1).setDelegate(addr2.address);

      const addr1WeightAfter = await dao.getDelegateWeight(addr1.address);
      const addr2WeightAfter = await dao.getDelegateWeight(addr2.address);

      expect(addr1WeightAfter).to.equal(0);
      expect(addr2WeightAfter).to.equal(addr2WeightBefore + addr1WeightBefore);
    });

    it("Should revert if delegating to zero address", async function () {
      const { dao, addr1 } = await loadFixture(deployDAOFixture);
      await expect(
        dao.connect(addr1).setDelegate(ethers.ZeroAddress)
      ).to.be.revertedWith("invalid delegate");
    });

    it("Should revert if already delegated to same address", async function () {
      const { dao, govToken, addr1, addr2 } = await loadFixture(deployDAOFixture);
      const stakeAmount = ethers.parseEther("100");

      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      await dao.connect(addr1).setDelegate(addr2.address);

      await expect(
        dao.connect(addr1).setDelegate(addr2.address)
      ).to.be.revertedWith("already delegated");
    });
  });

  describe("Proposal Creation", function () {
    it("Should allow users with sufficient stake to create proposals", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      const stakeAmount = ethers.parseEther("150");

      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);

      const description = "Test Proposal";
      const votingBlocks = 100;
      const proposalData = "0x";

      await expect(
        dao.connect(addr1).createProposal(description, votingBlocks, proposalData)
      )
        .to.emit(dao, "ProposalCreated")
        .withArgs(1, addr1.address, await ethers.provider.getBlockNumber() + 1, await ethers.provider.getBlockNumber() + 1 + votingBlocks);

      const proposal = await dao.getProposal(1);
      expect(proposal.id).to.equal(1);
      expect(proposal.proposer).to.equal(addr1.address);
      expect(proposal.description).to.equal(description);
    });

    it("Should revert if stake below threshold", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      const stakeAmount = ethers.parseEther("50"); // Below threshold of 100

      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);

      await expect(
        dao.connect(addr1).createProposal("Test", 100, "0x")
      ).to.be.revertedWith("insufficient stake to propose");
    });

    it("Should revert if voting blocks is 0", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      const stakeAmount = ethers.parseEther("150");

      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);

      await expect(
        dao.connect(addr1).createProposal("Test", 0, "0x")
      ).to.be.revertedWith("votingBlocks>0");
    });
  });

  describe("Voting", function () {
    async function createProposalFixture() {
      const fixture = await deployDAOFixture();
      const { dao, govToken, addr1 } = fixture;
      
      const stakeAmount = ethers.parseEther("150");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      await dao.connect(addr1).createProposal("Test Proposal", 100, "0x");
      
      return { ...fixture, proposalId: 1 };
    }

    it("Should allow delegates to vote", async function () {
      const { dao, govToken, addr2, proposalId } = await loadFixture(createProposalFixture);
      
      const stakeAmount = ethers.parseEther("100");
      await govToken.connect(addr2).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr2).stake(stakeAmount);

      await expect(dao.connect(addr2).vote(proposalId, true))
        .to.emit(dao, "Voted");

      expect(await dao.hasVoted(proposalId, addr2.address)).to.be.true;
    });

    it("Should count votes with quadratic weight", async function () {
      const { dao, govToken, addr2, proposalId } = await loadFixture(createProposalFixture);
      
      const stakeAmount = ethers.parseEther("100");
      await govToken.connect(addr2).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr2).stake(stakeAmount);

      await dao.connect(addr2).vote(proposalId, true);

      const proposal = await dao.getProposal(proposalId);
      expect(proposal.forVotes).to.be.greaterThan(0);
    });

    it("Should revert if voting period has ended", async function () {
      const { dao, govToken, addr2, proposalId } = await loadFixture(createProposalFixture);
      
      const stakeAmount = ethers.parseEther("100");
      await govToken.connect(addr2).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr2).stake(stakeAmount);

      // Mine 101 blocks (voting period is 100)
      await time.increase(101);
      for (let i = 0; i < 101; i++) {
        await ethers.provider.send("evm_mine", []);
      }

      await expect(
        dao.connect(addr2).vote(proposalId, true)
      ).to.be.revertedWith("voting closed");
    });

    it("Should revert if already voted", async function () {
      const { dao, govToken, addr2, proposalId } = await loadFixture(createProposalFixture);
      
      const stakeAmount = ethers.parseEther("100");
      await govToken.connect(addr2).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr2).stake(stakeAmount);

      await dao.connect(addr2).vote(proposalId, true);
      
      await expect(
        dao.connect(addr2).vote(proposalId, true)
      ).to.be.revertedWith("already voted");
    });

    it("Should revert if no delegated weight", async function () {
      const { dao, addr3, proposalId } = await loadFixture(createProposalFixture);
      
      await expect(
        dao.connect(addr3).vote(proposalId, true)
      ).to.be.revertedWith("no delegated weight");
    });
  });

  describe("Proposal Finalization", function () {
    async function votedProposalFixture() {
      const fixture = await deployDAOFixture();
      const { dao, govToken, addr1, addr2, addr3 } = fixture;
      
      // Stake and create proposal
      const stakeAmount = ethers.parseEther("150");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      await dao.connect(addr1).createProposal("Test Proposal", 100, "0x");
      
      // Additional members vote
      await govToken.connect(addr2).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr2).stake(stakeAmount);
      await govToken.connect(addr3).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr3).stake(stakeAmount);
      
      await dao.connect(addr1).vote(1, true);
      await dao.connect(addr2).vote(1, true);
      
      return { ...fixture, proposalId: 1 };
    }

    it("Should finalize proposal after voting period", async function () {
      const { dao, proposalId } = await loadFixture(votedProposalFixture);
      
      // Move past voting period
      for (let i = 0; i < 101; i++) {
        await ethers.provider.send("evm_mine", []);
      }

      await expect(dao.finalizeProposal(proposalId))
        .to.emit(dao, "ProposalFinalized");

      const proposal = await dao.getProposal(proposalId);
      expect(proposal.finalized).to.be.true;
    });

    it("Should revert if voting period not ended", async function () {
      const { dao, proposalId } = await loadFixture(votedProposalFixture);
      
      await expect(
        dao.finalizeProposal(proposalId)
      ).to.be.revertedWith("voting still open");
    });

    it("Should revert if already finalized", async function () {
      const { dao, proposalId } = await loadFixture(votedProposalFixture);
      
      // Move past voting period
      for (let i = 0; i < 101; i++) {
        await ethers.provider.send("evm_mine", []);
      }

      await dao.finalizeProposal(proposalId);
      
      await expect(
        dao.finalizeProposal(proposalId)
      ).to.be.revertedWith("already finalized");
    });
  });

  describe("Proposal Execution", function () {
    async function finalizedProposalFixture() {
      const fixture = await votedProposalFixture();
      const { dao, proposalId } = fixture;
      
      // Move past voting period and finalize
      for (let i = 0; i < 101; i++) {
        await ethers.provider.send("evm_mine", []);
      }
      await dao.finalizeProposal(proposalId);
      
      return fixture;
    }

    async function votedProposalFixture() {
      const fixture = await deployDAOFixture();
      const { dao, govToken, addr1, addr2, addr3 } = fixture;
      
      const stakeAmount = ethers.parseEther("150");
      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      await dao.connect(addr1).createProposal("Test Proposal", 100, "0x");
      
      await govToken.connect(addr2).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr2).stake(stakeAmount);
      await govToken.connect(addr3).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr3).stake(stakeAmount);
      
      await dao.connect(addr1).vote(1, true);
      await dao.connect(addr2).vote(1, true);
      
      return { ...fixture, proposalId: 1 };
    }

    it("Should execute passed proposal", async function () {
      const { dao, proposalId } = await loadFixture(finalizedProposalFixture);
      
      await expect(dao.executeProposal(proposalId))
        .to.emit(dao, "ProposalExecuted");

      const proposal = await dao.getProposal(proposalId);
      expect(proposal.executed).to.be.true;
    });

    it("Should revert if not finalized", async function () {
      const { dao, proposalId } = await loadFixture(votedProposalFixture);
      
      await expect(
        dao.executeProposal(proposalId)
      ).to.be.revertedWith("not finalized");
    });

    it("Should revert if already executed", async function () {
      const { dao, proposalId } = await loadFixture(finalizedProposalFixture);
      
      await dao.executeProposal(proposalId);
      
      await expect(
        dao.executeProposal(proposalId)
      ).to.be.revertedWith("already executed");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update proposal threshold", async function () {
      const { dao, owner } = await loadFixture(deployDAOFixture);
      const newThreshold = ethers.parseEther("200");

      await expect(dao.connect(owner).updateProposalThreshold(newThreshold))
        .to.emit(dao, "ThresholdUpdated")
        .withArgs(newThreshold);

      expect(await dao.proposalStakeThreshold()).to.equal(newThreshold);
    });

    it("Should allow owner to update quorum percentage", async function () {
      const { dao, owner } = await loadFixture(deployDAOFixture);
      const newQuorum = 15;

      await expect(dao.connect(owner).updateQuorumPercentage(newQuorum))
        .to.emit(dao, "QuorumUpdated")
        .withArgs(newQuorum);

      expect(await dao.quorumPercentage()).to.equal(newQuorum);
    });

    it("Should revert if non-owner tries to update threshold", async function () {
      const { dao, addr1 } = await loadFixture(deployDAOFixture);
      const newThreshold = ethers.parseEther("200");

      await expect(
        dao.connect(addr1).updateProposalThreshold(newThreshold)
      ).to.be.revertedWith("Only owner");
    });

    it("Should revert if quorum percentage above 100", async function () {
      const { dao, owner } = await loadFixture(deployDAOFixture);
      
      await expect(
        dao.connect(owner).updateQuorumPercentage(101)
      ).to.be.revertedWith("invalid quorum");
    });
  });

  describe("View Functions", function () {
    it("Should return correct total staked amount", async function () {
      const { dao, govToken, addr1, addr2 } = await loadFixture(deployDAOFixture);
      const stakeAmount = ethers.parseEther("100");

      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      await govToken.connect(addr2).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr2).stake(stakeAmount);

      const totalStaked = await dao.getTotalStaked();
      expect(totalStaked).to.equal(stakeAmount * 2n);
    });

    it("Should return correct member count", async function () {
      const { dao, govToken, addr1, addr2, addr3 } = await loadFixture(deployDAOFixture);
      const stakeAmount = ethers.parseEther("100");

      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      await govToken.connect(addr2).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr2).stake(stakeAmount);
      await govToken.connect(addr3).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr3).stake(stakeAmount);

      expect(await dao.getMemberCount()).to.equal(3);
    });

    it("Should return all proposal IDs", async function () {
      const { dao, govToken, addr1 } = await loadFixture(deployDAOFixture);
      const stakeAmount = ethers.parseEther("150");

      await govToken.connect(addr1).approve(await dao.getAddress(), stakeAmount);
      await dao.connect(addr1).stake(stakeAmount);
      
      await dao.connect(addr1).createProposal("Proposal 1", 100, "0x");
      await dao.connect(addr1).createProposal("Proposal 2", 100, "0x");

      const proposals = await dao.getAllProposals();
      expect(proposals.length).to.equal(2);
      expect(proposals[0]).to.equal(1);
      expect(proposals[1]).to.equal(2);
    });
  });
});

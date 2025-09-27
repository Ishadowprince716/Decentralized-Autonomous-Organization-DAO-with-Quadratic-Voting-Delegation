// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Additional imports for new features
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title Ultra-Advanced DAO with Cutting-Edge Features - Enhanced Version
 * @dev Improved version with optimizations, security fixes, and new features
 * @author Enhanced for SIH 2025
 */
contract UltraAdvancedDAO is EnhancedAdvancedDAO, Pausable {
    using ECDSA for bytes32;
    using SafeMath for uint256;

    // --- CONSTANTS FOR GAS OPTIMIZATION ---
    uint256 private constant MAX_ARRAY_LENGTH = 100;
    uint256 private constant PRECISION_FACTOR = 10**18;
    uint256 private constant MAX_CONVICTION_DECAY = 365 days;
    uint256 private constant MIN_PROPOSAL_DELAY = 1 hours;
    uint256 private constant MAX_SLASHING_PERCENTAGE = 50; // 50% max slashing

    // --- IMPROVED NFT-BASED MEMBERSHIP & REPUTATION SYSTEM ---
    struct NFTGating {
        address nftContract;
        uint256 minTokens;
        bool isERC1155;
        uint256 tokenId;
        uint256 votingPowerMultiplier; // NEW: Different NFTs give different power
        bool isActive;
    }

    struct ReputationScore {
        uint256 score;
        uint256 successfulProposals;
        uint256 participationRate;
        uint256 delegationTrust;
        bool isVerified;
        uint256 lastUpdate; // NEW: Track reputation updates
        uint256 streakCount; // NEW: Consecutive participation streak
    }

    mapping(address => ReputationScore) public reputation;
    mapping(address => NFTGating) public nftGatingRules;
    address[] public acceptedNFTContracts;
    mapping(address => bool) private isAcceptedNFT; // NEW: O(1) lookup

    // --- ENHANCED PREDICTION MARKETS & FUTARCHY ---
    struct PredictionMarket {
        uint256 proposalId;
        uint256 yesPool;
        uint256 noPool;
        uint256 endTime;
        bool resolved;
        bool outcome;
        uint256 totalVolume; // NEW: Track trading volume
        uint256 liquidityReward; // NEW: Rewards for market makers
        mapping(address => uint256) yesShares;
        mapping(address => uint256) noShares;
        mapping(address => bool) hasWithdrawn; // NEW: Track withdrawals
    }

    mapping(uint256 => PredictionMarket) public predictionMarkets;
    uint256 public constant MARKET_DURATION = 3 days;
    uint256 public marketMakerRewardRate = 100; // 1% in basis points

    // --- ENHANCED CROSS-CHAIN GOVERNANCE ---
    struct CrossChainProposal {
        uint256 localProposalId;
        uint256[] chainIds;
        mapping(uint256 => bool) executedOnChain;
        bytes32 merkleRoot;
        uint256 crossChainFee; // NEW: Fee for cross-chain execution
        bool isEmergency; // NEW: Emergency cross-chain proposals
    }

    mapping(uint256 => CrossChainProposal) public crossChainProposals;
    mapping(uint256 => bool) public supportedChainIds;

    // --- ENHANCED AI-POWERED PROPOSAL ANALYSIS ---
    struct AIAnalysis {
        uint256 riskScore;
        uint256 impactScore;
        uint256 feasibilityScore;
        string aiSummary;
        bool requiresExpertReview;
        uint256 confidenceLevel; // NEW: AI confidence in analysis
        uint256 analysisTimestamp; // NEW: When analysis was performed
        address[] expertReviewers; // NEW: Required expert reviewers
    }

    mapping(uint256 => AIAnalysis) public aiAnalysis;
    address public aiOracle;
    mapping(address => bool) public authorizedExperts; // NEW: Expert reviewers

    // --- ENHANCED DYNAMIC VOTING MECHANISMS ---
    enum VotingMechanism { 
        Standard, 
        Quadratic, 
        ConvictionVoting, 
        RankedChoice, 
        LiquidDemocracy,
        FutarchyBased,
        WeightedVoting, // NEW
        TokenHolderVoting // NEW
    }

    struct ConvictionVoting {
        mapping(address => uint256) conviction;
        mapping(address => uint256) lastVoteTime;
        uint256 convictionThreshold;
        uint256 totalConviction;
        uint256 decayRate; // NEW: Configurable decay rate
        uint256 maxConviction; // NEW: Cap on conviction
    }

    struct LiquidDemocracy {
        mapping(address => address) delegates;
        mapping(address => uint256) delegatedVotingPower;
        mapping(address => address[]) delegators; // NEW: Track who delegates to whom
        uint256 maxDelegationDepth; // NEW: Prevent infinite delegation chains
    }

    mapping(uint256 => VotingMechanism) public proposalVotingType;
    mapping(uint256 => ConvictionVoting) public convictionVotes;
    mapping(uint256 => LiquidDemocracy) public liquidDemocracy;

    // --- ENHANCED STAKING & SLASHING MECHANISM ---
    struct StakingInfo {
        uint256 stakedAmount;
        uint256 lockEndTime;
        uint256 rewardMultiplier;
        bool canBeSlashed;
        uint256 slashingHistory; // NEW: Track past slashing events
        uint256 rewardsClaimed; // NEW: Track claimed rewards
        uint256 stakingTier; // NEW: Different tiers with different benefits
    }

    mapping(address => StakingInfo) public memberStaking;
    uint256 public totalStaked;
    uint256 public slashingPool;
    uint256[] public stakingTiers = [0.1 ether, 1 ether, 10 ether]; // NEW: Tier thresholds
    uint256[] public tierMultipliers = [100, 200, 500]; // NEW: Tier benefits (in basis points)

    // --- NEW: TREASURY MANAGEMENT ---
    struct TreasuryAllocation {
        uint256 proposalBudget;     // Budget for new proposals
        uint256 operationalFund;    // Day-to-day operations
        uint256 emergencyReserve;   // Emergency situations
        uint256 stakingRewards;     // Staking reward pool
        uint256 developmentFund;    // Future development
    }

    TreasuryAllocation public treasuryAllocation;
    mapping(address => uint256) public contributorRewards; // NEW: Track contributor rewards

    // --- NEW: TIME-LOCKED PROPOSALS ---
    struct TimeLock {
        uint256 delay;
        uint256 proposalId;
        uint256 executeAfter;
        bool executed;
        bytes32 txHash;
    }

    mapping(uint256 => TimeLock) public proposalTimeLocks;
    uint256 public defaultTimeLockDelay = 2 days;

    // --- ENHANCED MULTI-SIGNATURE PROPOSALS ---
    struct MultiSigProposal {
        address[] signers;
        mapping(address => bool) hasSigned;
        mapping(address => uint256) signatureTimestamp; // NEW: Track when signed
        uint256 requiredSignatures;
        uint256 currentSignatures;
        bytes32 proposalHash;
        uint256 expiryTime; // NEW: Signature expiry
        bool isEmergency; // NEW: Emergency multi-sig
    }

    mapping(uint256 => MultiSigProposal) public multiSigProposals;

    // --- ENHANCED GASLESS VOTING (META-TRANSACTIONS) ---
    mapping(address => uint256) public nonces;
    bytes32 public constant VOTE_TYPEHASH = keccak256(
        "Vote(uint256 proposalId,bool support,uint256 credits,uint256 nonce,uint256 deadline)"
    );

    mapping(address => bool) public authorizedRelayers; // NEW: Authorized meta-tx relayers
    uint256 public gaslessVotingReward = 0.001 ether; // NEW: Reward for relayers

    // --- NEW: PROPOSAL CATEGORIES & TEMPLATES ---
    enum ProposalCategory {
        Treasury,
        Governance,
        Technical,
        Community,
        Emergency,
        CrossChain,
        Partnership
    }

    struct ProposalTemplate {
        string name;
        ProposalCategory category;
        uint256 minVotingPower;
        uint256 minStake;
        VotingMechanism votingType;
        uint256 votingDuration;
        bool requiresAIAnalysis;
        bool requiresExpertReview;
    }

    mapping(uint256 => ProposalTemplate) public proposalTemplates;
    mapping(uint256 => ProposalCategory) public proposalCategories;
    uint256 public templateCounter;

    // --- ENHANCED EVENTS ---
    event ReputationUpdated(address indexed member, uint256 newScore, uint256 streakCount);
    event NFTGatingEnabled(address indexed nftContract, uint256 minTokens, uint256 multiplier);
    event PredictionMarketCreated(uint256 indexed proposalId, uint256 endTime, uint256 liquidityReward);
    event PredictionMarketResolved(uint256 indexed proposalId, bool outcome, uint256 totalVolume);
    event CrossChainProposalCreated(uint256 indexed proposalId, uint256[] chainIds, uint256 fee);
    event AIAnalysisCompleted(uint256 indexed proposalId, uint256 riskScore, uint256 confidence);
    event MemberStaked(address indexed member, uint256 amount, uint256 lockTime, uint256 tier);
    event MemberSlashed(address indexed member, uint256 amount, string reason, uint256 newHistory);
    event GaslessVoteCast(address indexed voter, uint256 indexed proposalId, address relayer);
    event ProposalTemplateCreated(uint256 indexed templateId, string name, ProposalCategory category);
    event TreasuryRebalanced(uint256 proposalBudget, uint256 operationalFund, uint256 emergencyReserve);
    event TimeLockProposalScheduled(uint256 indexed proposalId, uint256 executeAfter);

    // --- MODIFIERS ---
    modifier onlyExpert() {
        require(authorizedExperts[msg.sender], "Not authorized expert");
        _;
    }

    modifier onlyRelayer() {
        require(authorizedRelayers[msg.sender], "Not authorized relayer");
        _;
    }

    modifier validProposal(uint256 _proposalId) {
        require(_proposalId < proposalCounter, "Invalid proposal");
        _;
    }

    modifier notSlashed(address _member) {
        require(memberStaking[_member].slashingHistory < 3, "Member slashed too many times");
        _;
    }

    // --- ENHANCED NFT-BASED MEMBERSHIP FUNCTIONS ---
    function enableNFTGating(
        address _nftContract,
        uint256 _minTokens,
        bool _isERC1155,
        uint256 _tokenId,
        uint256 _multiplier
    ) external onlyOwner {
        require(_nftContract != address(0), "Invalid contract address");
        require(_multiplier > 0 && _multiplier <= 1000, "Invalid multiplier"); // Max 10x
        
        nftGatingRules[_nftContract] = NFTGating({
            nftContract: _nftContract,
            minTokens: _minTokens,
            isERC1155: _isERC1155,
            tokenId: _tokenId,
            votingPowerMultiplier: _multiplier,
            isActive: true
        });

        if (!isAcceptedNFT[_nftContract]) {
            acceptedNFTContracts.push(_nftContract);
            isAcceptedNFT[_nftContract] = true;
        }
        
        emit NFTGatingEnabled(_nftContract, _minTokens, _multiplier);
    }

    function joinDAOWithNFT(address _nftContract) external payable nonReentrant whenNotPaused {
        require(_hasRequiredNFTs(msg.sender, _nftContract), "Insufficient NFTs");
        require(nftGatingRules[_nftContract].isActive, "NFT gating disabled");
        
        if (members[msg.sender].isMember) revert AlreadyMember();
        if (msg.value < MEMBERSHIP_FEE) revert InsufficientFee();

        uint256 nftBonus = _calculateNFTVotingBonus(msg.sender, _nftContract);
        uint256 votingPower = MIN_VOTING_POWER + nftBonus;
        
        members[msg.sender] = Member({
            isMember: true,
            votingPower: uint128(votingPower),
            delegate: address(0),
            delegatedPower: 0,
            joinedAt: uint64(block.timestamp),
            delegationExpiry: 0
        });
        
        // Initialize enhanced reputation
        reputation[msg.sender] = ReputationScore({
            score: 100,
            successfulProposals: 0,
            participationRate: 0,
            delegationTrust: 0,
            isVerified: false,
            lastUpdate: block.timestamp,
            streakCount: 0
        });

        memberCount++;
        emit MemberAdded(msg.sender, votingPower);
    }

    // --- ENHANCED PREDICTION MARKET FUNCTIONS ---
    function createPredictionMarket(
        uint256 _proposalId,
        uint256 _liquidityReward
    ) external payable validProposal(_proposalId) {
        require(msg.value >= 0.1 ether, "Insufficient seed funding");
        require(_liquidityReward <= msg.value / 2, "Liquidity reward too high");

        PredictionMarket storage market = predictionMarkets[_proposalId];
        market.proposalId = _proposalId;
        market.yesPool = (msg.value - _liquidityReward) / 2;
        market.noPool = (msg.value - _liquidityReward) / 2;
        market.endTime = block.timestamp + MARKET_DURATION;
        market.resolved = false;
        market.liquidityReward = _liquidityReward;

        emit PredictionMarketCreated(_proposalId, market.endTime, _liquidityReward);
    }

    function buyPredictionShares(
        uint256 _proposalId,
        bool _buyYes,
        uint256 _amount
    ) external payable nonReentrant whenNotPaused validProposal(_proposalId) {
        require(msg.value == _amount, "Incorrect payment");
        require(_amount >= 0.01 ether, "Minimum bet required");
        
        PredictionMarket storage market = predictionMarkets[_proposalId];
        require(block.timestamp < market.endTime, "Market ended");
        require(!market.resolved, "Market resolved");

        if (_buyYes) {
            market.yesPool = market.yesPool.add(_amount);
            market.yesShares[msg.sender] = market.yesShares[msg.sender].add(_amount);
        } else {
            market.noPool = market.noPool.add(_amount);
            market.noShares[msg.sender] = market.noShares[msg.sender].add(_amount);
        }
        
        market.totalVolume = market.totalVolume.add(_amount);
        _updateReputationForMarketParticipation(msg.sender);
    }

    function resolvePredictionMarket(
        uint256 _proposalId,
        bool _outcome
    ) external onlyAuthorized validProposal(_proposalId) {
        PredictionMarket storage market = predictionMarkets[_proposalId];
        require(block.timestamp >= market.endTime, "Market still active");
        require(!market.resolved, "Already resolved");

        market.resolved = true;
        market.outcome = _outcome;

        emit PredictionMarketResolved(_proposalId, _outcome, market.totalVolume);
    }

    function claimPredictionRewards(uint256 _proposalId) external nonReentrant validProposal(_proposalId) {
        PredictionMarket storage market = predictionMarkets[_proposalId];
        require(market.resolved, "Market not resolved");
        require(!market.hasWithdrawn[msg.sender], "Already withdrawn");

        uint256 reward = _calculatePredictionReward(msg.sender, _proposalId);
        require(reward > 0, "No rewards to claim");

        market.hasWithdrawn[msg.sender] = true;
        _safeTransfer(msg.sender, reward);
    }

    // --- ENHANCED CONVICTION VOTING FUNCTIONS ---
    function castConvictionVote(
        uint256 _proposalId,
        uint256 _conviction
    ) external validProposal(_proposalId) whenNotPaused {
        require(proposalVotingType[_proposalId] == VotingMechanism.ConvictionVoting, "Not conviction voting");
        require(_conviction > 0, "Must have conviction");
        
        ConvictionVoting storage cv = convictionVotes[_proposalId];
        require(_conviction <= cv.maxConviction, "Conviction too high");
        
        // Calculate conviction decay
        uint256 currentConviction = _calculateCurrentConviction(msg.sender, _proposalId);
        uint256 newConviction = currentConviction.add(_conviction);
        
        cv.conviction[msg.sender] = newConviction;
        cv.lastVoteTime[msg.sender] = block.timestamp;
        cv.totalConviction = cv.totalConviction.add(_conviction);
        
        _updateReputationForParticipation(msg.sender);
        
        // Check if threshold reached
        if (cv.totalConviction >= cv.convictionThreshold) {
            _executeConvictionProposal(_proposalId);
        }
    }

    function withdrawConviction(uint256 _proposalId) external validProposal(_proposalId) {
        ConvictionVoting storage cv = convictionVotes[_proposalId];
        uint256 userConviction = cv.conviction[msg.sender];
        require(userConviction > 0, "No conviction to withdraw");

        cv.conviction[msg.sender] = 0;
        cv.totalConviction = cv.totalConviction.sub(userConviction);
        cv.lastVoteTime[msg.sender] = 0;
    }

    // --- ENHANCED STAKING FUNCTIONS ---
    function stakeMembership(uint256 _lockDays) external payable nonReentrant whenNotPaused notSlashed(msg.sender) {
        require(msg.value >= stakingTiers[0], "Below minimum stake");
        require(_lockDays >= 7 && _lockDays <= 365, "Invalid lock period");

        StakingInfo storage stake = memberStaking[msg.sender];
        require(stake.stakedAmount == 0, "Already staking");

        uint256 tier = _getStakingTier(msg.value);
        uint256 multiplier = _calculateStakeMultiplier(_lockDays, tier);
        
        stake.stakedAmount = msg.value;
        stake.lockEndTime = block.timestamp + (_lockDays * 1 days);
        stake.rewardMultiplier = multiplier;
        stake.canBeSlashed = true;
        stake.stakingTier = tier;

        totalStaked = totalStaked.add(msg.value);
        
        // Increase voting power based on stake and tier
        uint256 powerIncrease = _calculateVotingPowerIncrease(msg.value, tier);
        members[msg.sender].votingPower += uint128(powerIncrease);
        
        emit MemberStaked(msg.sender, msg.value, stake.lockEndTime, tier);
    }

    function unstakeMembership() external nonReentrant whenNotPaused {
        StakingInfo storage stake = memberStaking[msg.sender];
        require(stake.stakedAmount > 0, "No stake found");
        require(block.timestamp >= stake.lockEndTime, "Still locked");

        uint256 amount = stake.stakedAmount;
        uint256 rewards = _calculateStakingRewards(msg.sender);
        uint256 powerDecrease = _calculateVotingPowerIncrease(amount, stake.stakingTier);
        
        // Reset staking info
        members[msg.sender].votingPower -= uint128(powerDecrease);
        totalStaked = totalStaked.sub(amount);
        delete memberStaking[msg.sender];

        // Transfer stake + rewards
        _safeTransfer(msg.sender, amount.add(rewards));
    }

    // --- NEW: TREASURY MANAGEMENT FUNCTIONS ---
    function rebalanceTreasury(
        uint256 _proposalBudget,
        uint256 _operationalFund,
        uint256 _emergencyReserve,
        uint256 _stakingRewards,
        uint256 _developmentFund
    ) external onlyAuthorized {
        uint256 totalAllocation = _proposalBudget.add(_operationalFund).add(_emergencyReserve)
            .add(_stakingRewards).add(_developmentFund);
        
        require(totalAllocation <= address(this).balance, "Insufficient treasury balance");
        
        treasuryAllocation = TreasuryAllocation({
            proposalBudget: _proposalBudget,
            operationalFund: _operationalFund,
            emergencyReserve: _emergencyReserve,
            stakingRewards: _stakingRewards,
            developmentFund: _developmentFund
        });
        
        emit TreasuryRebalanced(_proposalBudget, _operationalFund, _emergencyReserve);
    }

    function allocateContributorReward(
        address _contributor,
        uint256 _amount
    ) external onlyAuthorized {
        require(_amount <= treasuryAllocation.operationalFund, "Exceeds operational fund");
        
        contributorRewards[_contributor] = contributorRewards[_contributor].add(_amount);
        treasuryAllocation.operationalFund = treasuryAllocation.operationalFund.sub(_amount);
    }

    function claimContributorReward() external nonReentrant {
        uint256 reward = contributorRewards[msg.sender];
        require(reward > 0, "No rewards to claim");
        
        contributorRewards[msg.sender] = 0;
        _safeTransfer(msg.sender, reward);
    }

    // --- NEW: PROPOSAL TEMPLATES ---
    function createProposalTemplate(
        string memory _name,
        ProposalCategory _category,
        uint256 _minVotingPower,
        uint256 _minStake,
        VotingMechanism _votingType,
        uint256 _votingDuration,
        bool _requiresAIAnalysis,
        bool _requiresExpertReview
    ) external onlyAuthorized returns (uint256) {
        uint256 templateId = templateCounter++;
        
        proposalTemplates[templateId] = ProposalTemplate({
            name: _name,
            category: _category,
            minVotingPower: _minVotingPower,
            minStake: _minStake,
            votingType: _votingType,
            votingDuration: _votingDuration,
            requiresAIAnalysis: _requiresAIAnalysis,
            requiresExpertReview: _requiresExpertReview
        });
        
        emit ProposalTemplateCreated(templateId, _name, _category);
        return templateId;
    }

    function createProposalFromTemplate(
        uint256 _templateId,
        string memory _descriptionHash,
        address payable _recipient,
        uint256 _amount
    ) external payable returns (uint256) {
        require(_templateId < templateCounter, "Invalid template");
        
        ProposalTemplate memory template = proposalTemplates[_templateId];
        require(members[msg.sender].votingPower >= template.minVotingPower, "Insufficient voting power");
        
        if (template.minStake > 0) {
            require(memberStaking[msg.sender].stakedAmount >= template.minStake, "Insufficient stake");
        }
        
        uint256 proposalId = _createSingleProposal(_descriptionHash, _recipient, _amount);
        proposalCategories[proposalId] = template.category;
        proposalVotingType[proposalId] = template.votingType;
        
        if (template.requiresAIAnalysis) {
            requestAIAnalysis(proposalId);
        }
        
        return proposalId;
    }

    // --- NEW: TIME-LOCKED PROPOSALS ---
    function scheduleTimeLockProposal(uint256 _proposalId) external onlyAuthorized validProposal(_proposalId) {
        require(proposals[_proposalId].state == ProposalState.Succeeded, "Proposal not succeeded");
        
        uint256 executeAfter = block.timestamp.add(defaultTimeLockDelay);
        proposalTimeLocks[_proposalId] = TimeLock({
            delay: defaultTimeLockDelay,
            proposalId: _proposalId,
            executeAfter: executeAfter,
            executed: false,
            txHash: keccak256(abi.encode(_proposalId, executeAfter))
        });
        
        emit TimeLockProposalScheduled(_proposalId, executeAfter);
    }

    function executeTimeLockProposal(uint256 _proposalId) external validProposal(_proposalId) {
        TimeLock storage timeLock = proposalTimeLocks[_proposalId];
        require(block.timestamp >= timeLock.executeAfter, "Still in timelock");
        require(!timeLock.executed, "Already executed");
        
        timeLock.executed = true;
        _executeProposal(_proposalId);
    }

    // --- ENHANCED GASLESS VOTING (META-TRANSACTIONS) ---
    function voteWithSignature(
        uint256 _proposalId,
        bool _support,
        uint256 _credits,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external nonReentrant onlyRelayer validProposal(_proposalId) {
        require(block.timestamp <= _deadline, "Signature expired");
        
        bytes32 structHash = keccak256(abi.encode(
            VOTE_TYPEHASH,
            _proposalId,
            _support,
            _credits,
            nonces[msg.sender],
            _deadline
        ));
        
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(_v, _r, _s);
        
        require(members[signer].isMember, "Signer not a member");
        nonces[signer]++;
        
        // Cast vote on behalf of signer
        _castVoteInternal(_proposalId, _support, _credits, signer);
        
        // Reward relayer
        _safeTransfer(msg.sender, gaslessVotingReward);
        
        emit GaslessVoteCast(signer, _proposalId, msg.sender);
    }

    // --- ENHANCED SLASHING MECHANISM ---
    function proposeSlashing(
        address _member,
        uint256 _percentage, // Percentage of stake to slash (0-MAX_SLASHING_PERCENTAGE)
        string memory _reason
    ) external onlyAuthorized returns (uint256) {
        require(memberStaking[_member].canBeSlashed, "Member cannot be slashed");
        require(_percentage > 0 && _percentage <= MAX_SLASHING_PERCENTAGE, "Invalid percentage");
        
        uint256 slashAmount = memberStaking[_member].stakedAmount.mul(_percentage).div(100);
        return _createSlashingProposal(_member, slashAmount, _reason);
    }

    function executeSlashing(
        uint256 _proposalId,
        address _member,
        uint256 _amount,
        string memory _reason
    ) external onlyAuthorized {
        require(proposals[_proposalId].state == ProposalState.Succeeded, "Proposal not succeeded");
        
        StakingInfo storage stake = memberStaking[_member];
        require(_amount <= stake.stakedAmount, "Amount exceeds stake");
        
        // Update staking info
        stake.stakedAmount = stake.stakedAmount.sub(_amount);
        stake.slashingHistory = stake.slashingHistory.add(1);
        
        // Add to slashing pool
        slashingPool = slashingPool.add(_amount);
        totalStaked = totalStaked.sub(_amount);
        
        // Reduce voting power
        uint256 powerReduction = _calculateVotingPowerIncrease(_amount, stake.stakingTier);
        members[_member].votingPower -= uint128(powerReduction);
        
        // Update reputation negatively
        _updateReputationForSlashing(_member);
        
        emit MemberSlashed(_member, _amount, _reason, stake.slashingHistory);
    }

    // --- ENHANCED INTERNAL HELPER FUNCTIONS ---
    function _hasRequiredNFTs(address _user, address _nftContract) internal view returns (bool) {
        NFTGating memory gating = nftGatingRules[_nftContract];
        
        if (gating.isERC1155) {
            return IERC1155(_nftContract).balanceOf(_user, gating.tokenId) >= gating.minTokens;
        } else {
            return IERC721(_nftContract).balanceOf(_user) >= gating.minTokens;
        }
    }

    function _calculateNFTVotingBonus(address _user, address _nftContract) internal view returns (uint256) {
        NFTGating memory gating = nftGatingRules[_nftContract];
        uint256 nftCount;
        
        if (gating.isERC1155) {
            nftCount = IERC1155(_nftContract).balanceOf(_user, gating.tokenId);
        } else {
            nftCount = IERC721(_nftContract).balanceOf(_user);
        }
        
        // Apply multiplier, capped at reasonable limit
        uint256 bonus = nftCount.mul(gating.votingPowerMultiplier).div(100);
        return bonus > 50 ? 50 : bonus; // Cap at 50 bonus power
    }
    // --- CONTINUED INTERNAL FUNCTIONS ---

    // Calculates the current conviction for a user on a proposal considering decay since last vote
    function _calculateCurrentConviction(address _voter, uint256 _proposalId) internal view returns (uint256) {
        ConvictionVoting storage cv = convictionVotes[_proposalId];
        
        uint256 lastTime = cv.lastVoteTime[_voter];
        uint256 baseConviction = cv.conviction[_voter];
        
        if (lastTime == 0) {
            return 0;
        }
        
        uint256 timePassed = block.timestamp.sub(lastTime);
        uint256 decayRate = cv.decayRate;
        
        if (timePassed >= MAX_CONVICTION_DECAY) {
            return 0;
        }
        
        // Apply decay linearly: new conviction = baseConviction * (1 - decayRatio)
        uint256 decayRatio = timePassed.mul(PRECISION_FACTOR).div(MAX_CONVICTION_DECAY);
        uint256 decayedConviction = baseConviction.mul(PRECISION_FACTOR.sub(decayRatio)).div(PRECISION_FACTOR);
        
        if (decayedConviction > cv.maxConviction) {
            return cv.maxConviction;
        } else {
            return decayedConviction;
        }
    }

    // Determines staking tier based on staked amount
    function _getStakingTier(uint256 _amount) internal view returns (uint256) {
        for (uint256 i = stakingTiers.length; i > 0; i--) {
            if (_amount >= stakingTiers[i - 1]) {
                return i; // tiers start from 1
            }
        }
        return 0; // Below minimum tier
    }

    // Calculates stake reward multiplier based on lock period and tier (basis points)
    function _calculateStakeMultiplier(uint256 _lockDays, uint256 _tier) internal view returns (uint256) {
        // Example: base multiplier by tier + bonus for lock days
        uint256 baseMultiplier = tierMultipliers[_tier - 1];
        uint256 lockBonus = (_lockDays.mul(10)); // 10 basis points per day locked
        uint256 totalMultiplier = baseMultiplier.add(lockBonus);

        // Cap multiplier at 1000 (10x)
        return totalMultiplier > 1000 ? 1000 : totalMultiplier;
    }

    // Calculates voting power increase based on stake and tier
    function _calculateVotingPowerIncrease(uint256 _amount, uint256 _tier) internal pure returns (uint256) {
        // Example formula: power increase proportional to amount and tier multiplier (in basis points)
        uint256 multiplier = _tier * 100; // e.g. tier 1 => 100 bps = 1x multiplier
        return _amount.mul(multiplier).div(10000); // Adjusted for basis points
    }

    // Calculates staking rewards for a member (simplified example)
    function _calculateStakingRewards(address _member) internal view returns (uint256) {
        StakingInfo storage stake = memberStaking[_member];
        // Example fixed reward based on rewardMultiplier and staked amount
        return stake.stakedAmount.mul(stake.rewardMultiplier).div(10000);
    }

    // Calculates prediction market rewards for a user
    function _calculatePredictionReward(address _user, uint256 _proposalId) internal view returns (uint256) {
        PredictionMarket storage market = predictionMarkets[_proposalId];
        require(market.resolved, "Market unresolved");

        uint256 userShares = market.outcome ? market.yesShares[_user] : market.noShares[_user];
        uint256 winningPool = market.outcome ? market.yesPool : market.noPool;
        uint256 losingPool = market.outcome ? market.noPool : market.yesPool;

        if (userShares == 0 || winningPool == 0) {
            return 0;
        }

        // User reward proportional to their shares, including reward from losing side minus liquidity reward
        uint256 reward = userShares.mul(winningPool.add(losingPool).sub(market.liquidityReward)).div(winningPool);
        return reward;
    }

    // Updates reputation for market participation (example)
    function _updateReputationForMarketParticipation(address _member) internal {
        ReputationScore storage rep = reputation[_member];
        rep.participationRate = rep.participationRate.add(1); // simplistic increment
        rep.lastUpdate = block.timestamp;
        emit ReputationUpdated(_member, rep.score, rep.streakCount);
    }

    // Updates reputation for general participation (example)
    function _updateReputationForParticipation(address _member) internal {
        ReputationScore storage rep = reputation[_member];
        rep.score = rep.score.add(10); // increment score by 10
        rep.streakCount = rep.streakCount.add(1);
        rep.lastUpdate = block.timestamp;
        emit ReputationUpdated(_member, rep.score, rep.streakCount);
    }

    // Updates reputation negatively due to slashing
    function _updateReputationForSlashing(address _member) internal {
        ReputationScore storage rep = reputation[_member];
        if (rep.score > 20) {
            rep.score = rep.score.sub(20); // decrement score by 20
        } else {
            rep.score = 0;
        }
        rep.streakCount = 0;
        rep.lastUpdate = block.timestamp;
        emit ReputationUpdated(_member, rep.score, rep.streakCount);
    }

    // Safe ETH transfer helper
    function _safeTransfer(address _to, uint256 _amount) internal {
        (bool success, ) = _to.call{value: _amount}("");
        require(success, "Transfer failed");
    }


    function _calculateCurrentConviction(address


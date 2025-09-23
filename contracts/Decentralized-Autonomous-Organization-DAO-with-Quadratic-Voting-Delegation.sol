// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Additional imports for new features
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title Ultra-Advanced DAO with Cutting-Edge Features
 * @dev Additional features to make your DAO stand out in SIH 2025
 */
contract UltraAdvancedDAO is EnhancedAdvancedDAO {
    using ECDSA for bytes32;

    // --- NEW FEATURE 1: NFT-Based Membership & Reputation System ---
    struct NFTGating {
        address nftContract;
        uint256 minTokens;
        bool isERC1155;
        uint256 tokenId; // For ERC1155 specific token gating
    }

    struct ReputationScore {
        uint256 score;
        uint256 successfulProposals;
        uint256 participationRate;
        uint256 delegationTrust;
        bool isVerified; // KYC/verification status
    }

    mapping(address => ReputationScore) public reputation;
    mapping(address => NFTGating) public nftGatingRules;
    address[] public acceptedNFTContracts;

    // --- NEW FEATURE 2: Prediction Markets & Futarchy ---
    struct PredictionMarket {
        uint256 proposalId;
        uint256 yesPool;
        uint256 noPool;
        uint256 endTime;
        bool resolved;
        bool outcome;
        mapping(address => uint256) yesShares;
        mapping(address => uint256) noShares;
    }

    mapping(uint256 => PredictionMarket) public predictionMarkets;
    uint256 public constant MARKET_DURATION = 3 days;

    // --- NEW FEATURE 3: Cross-Chain Governance ---
    struct CrossChainProposal {
        uint256 localProposalId;
        uint256[] chainIds;
        mapping(uint256 => bool) executedOnChain;
        bytes32 merkleRoot; // For cross-chain vote verification
    }

    mapping(uint256 => CrossChainProposal) public crossChainProposals;

    // --- NEW FEATURE 4: AI-Powered Proposal Analysis ---
    struct AIAnalysis {
        uint256 riskScore; // 0-100
        uint256 impactScore; // 0-100
        uint256 feasibilityScore; // 0-100
        string aiSummary;
        bool requiresExpertReview;
    }

    mapping(uint256 => AIAnalysis) public aiAnalysis;
    address public aiOracle; // AI analysis provider

    // --- NEW FEATURE 5: Dynamic Voting Mechanisms ---
    enum VotingMechanism { 
        Standard, 
        Quadratic, 
        ConvictionVoting, 
        RankedChoice, 
        LiquidDemocracy,
        FutarchyBased
    }

    struct ConvictionVoting {
        mapping(address => uint256) conviction;
        mapping(address => uint256) lastVoteTime;
        uint256 convictionThreshold;
        uint256 totalConviction;
    }

    mapping(uint256 => VotingMechanism) public proposalVotingType;
    mapping(uint256 => ConvictionVoting) public convictionVotes;

    // --- NEW FEATURE 6: Staking & Slashing Mechanism ---
    struct StakingInfo {
        uint256 stakedAmount;
        uint256 lockEndTime;
        uint256 rewardMultiplier;
        bool canBeSlashed;
    }

    mapping(address => StakingInfo) public memberStaking;
    uint256 public totalStaked;
    uint256 public slashingPool;

    // --- NEW FEATURE 7: Multi-Signature Proposals ---
    struct MultiSigProposal {
        address[] signers;
        mapping(address => bool) hasSigned;
        uint256 requiredSignatures;
        uint256 currentSignatures;
        bytes32 proposalHash;
    }

    mapping(uint256 => MultiSigProposal) public multiSigProposals;

    // --- NEW FEATURE 8: Gasless Voting (Meta-Transactions) ---
    mapping(address => uint256) public nonces;
    bytes32 public constant VOTE_TYPEHASH = keccak256(
        "Vote(uint256 proposalId,bool support,uint256 credits,uint256 nonce,uint256 deadline)"
    );

    // --- EVENTS FOR NEW FEATURES ---
    event ReputationUpdated(address indexed member, uint256 newScore);
    event NFTGatingEnabled(address indexed nftContract, uint256 minTokens);
    event PredictionMarketCreated(uint256 indexed proposalId, uint256 endTime);
    event PredictionMarketResolved(uint256 indexed proposalId, bool outcome);
    event CrossChainProposalCreated(uint256 indexed proposalId, uint256[] chainIds);
    event AIAnalysisCompleted(uint256 indexed proposalId, uint256 riskScore);
    event MemberStaked(address indexed member, uint256 amount, uint256 lockTime);
    event MemberSlashed(address indexed member, uint256 amount, string reason);
    event GaslessVoteCast(address indexed voter, uint256 indexed proposalId);

    // --- NFT-BASED MEMBERSHIP FUNCTIONS ---
    function enableNFTGating(
        address _nftContract,
        uint256 _minTokens,
        bool _isERC1155,
        uint256 _tokenId
    ) external onlyOwner {
        nftGatingRules[_nftContract] = NFTGating({
            nftContract: _nftContract,
            minTokens: _minTokens,
            isERC1155: _isERC1155,
            tokenId: _tokenId
        });
        acceptedNFTContracts.push(_nftContract);
        emit NFTGatingEnabled(_nftContract, _minTokens);
    }

    function joinDAOWithNFT(address _nftContract) external payable nonReentrant {
        require(_hasRequiredNFTs(msg.sender, _nftContract), "Insufficient NFTs");
        
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
        
        // Initialize reputation
        reputation[msg.sender] = ReputationScore({
            score: 100, // Starting reputation
            successfulProposals: 0,
            participationRate: 0,
            delegationTrust: 0,
            isVerified: false
        });

        memberCount++;
        emit MemberAdded(msg.sender, votingPower);
    }

    // --- PREDICTION MARKET FUNCTIONS ---
    function createPredictionMarket(uint256 _proposalId) external payable {
        require(_proposalId < proposalCounter, "Invalid proposal");
        require(msg.value >= 0.1 ether, "Insufficient seed funding");

        PredictionMarket storage market = predictionMarkets[_proposalId];
        market.proposalId = _proposalId;
        market.yesPool = msg.value / 2;
        market.noPool = msg.value / 2;
        market.endTime = block.timestamp + MARKET_DURATION;
        market.resolved = false;

        emit PredictionMarketCreated(_proposalId, market.endTime);
    }

    function buyPredictionShares(
        uint256 _proposalId,
        bool _buyYes,
        uint256 _amount
    ) external payable nonReentrant {
        require(msg.value == _amount, "Incorrect payment");
        
        PredictionMarket storage market = predictionMarkets[_proposalId];
        require(block.timestamp < market.endTime, "Market ended");
        require(!market.resolved, "Market resolved");

        if (_buyYes) {
            market.yesPool += _amount;
            market.yesShares[msg.sender] += _amount;
        } else {
            market.noPool += _amount;
            market.noShares[msg.sender] += _amount;
        }
    }

    // --- CONVICTION VOTING FUNCTIONS ---
    function castConvictionVote(uint256 _proposalId, uint256 _conviction) external {
        require(proposalVotingType[_proposalId] == VotingMechanism.ConvictionVoting, "Not conviction voting");
        require(_conviction > 0, "Must have conviction");
        
        ConvictionVoting storage cv = convictionVotes[_proposalId];
        
        // Calculate conviction decay
        uint256 timeDecay = _calculateConvictionDecay(msg.sender, _proposalId);
        cv.conviction[msg.sender] = _conviction + timeDecay;
        cv.lastVoteTime[msg.sender] = block.timestamp;
        cv.totalConviction += _conviction;
        
        // Check if threshold reached
        if (cv.totalConviction >= cv.convictionThreshold) {
            _executeConvictionProposal(_proposalId);
        }
    }

    // --- STAKING FUNCTIONS ---
    function stakeMembership(uint256 _lockDays) external payable nonReentrant {
        require(msg.value >= 0.1 ether, "Minimum stake required");
        require(_lockDays >= 7 && _lockDays <= 365, "Invalid lock period");

        StakingInfo storage stake = memberStaking[msg.sender];
        require(stake.stakedAmount == 0, "Already staking");

        uint256 multiplier = _calculateStakeMultiplier(_lockDays);
        
        stake.stakedAmount = msg.value;
        stake.lockEndTime = block.timestamp + (_lockDays * 1 days);
        stake.rewardMultiplier = multiplier;
        stake.canBeSlashed = true;

        totalStaked += msg.value;
        
        // Increase voting power based on stake
        members[msg.sender].votingPower += uint128(multiplier);
        
        emit MemberStaked(msg.sender, msg.value, stake.lockEndTime);
    }

    function unstakeMembership() external nonReentrant {
        StakingInfo storage stake = memberStaking[msg.sender];
        require(stake.stakedAmount > 0, "No stake found");
        require(block.timestamp >= stake.lockEndTime, "Still locked");

        uint256 amount = stake.stakedAmount;
        uint256 rewards = _calculateStakingRewards(msg.sender);
        
        // Reset staking info
        members[msg.sender].votingPower -= uint128(stake.rewardMultiplier);
        totalStaked -= amount;
        delete memberStaking[msg.sender];

        // Transfer stake + rewards
        _safeTransfer(msg.sender, amount + rewards);
    }

    // --- GASLESS VOTING (META-TRANSACTIONS) ---
    function voteWithSignature(
        uint256 _proposalId,
        bool _support,
        uint256 _credits,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external nonReentrant {
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
        emit GaslessVoteCast(signer, _proposalId);
    }

    // --- AI ANALYSIS INTEGRATION ---
    function requestAIAnalysis(uint256 _proposalId) external {
        require(_proposalId < proposalCounter, "Invalid proposal");
        require(aiOracle != address(0), "AI Oracle not set");
        
        // This would trigger an external AI analysis
        // In practice, this would call an oracle or external service
    }

    function setAIAnalysis(
        uint256 _proposalId,
        uint256 _riskScore,
        uint256 _impactScore,
        uint256 _feasibilityScore,
        string memory _summary,
        bool _requiresReview
    ) external {
        require(msg.sender == aiOracle, "Only AI Oracle");
        
        aiAnalysis[_proposalId] = AIAnalysis({
            riskScore: _riskScore,
            impactScore: _impactScore,
            feasibilityScore: _feasibilityScore,
            aiSummary: _summary,
            requiresExpertReview: _requiresReview
        });
        
        emit AIAnalysisCompleted(_proposalId, _riskScore);
    }

    // --- SLASHING MECHANISM ---
    function proposeSlashing(
        address _member,
        uint256 _amount,
        string memory _reason
    ) external onlyAuthorized returns (uint256) {
        require(memberStaking[_member].canBeSlashed, "Member cannot be slashed");
        require(_amount <= memberStaking[_member].stakedAmount, "Insufficient stake");
        
        // Create a special slashing proposal
        return _createSlashingProposal(_member, _amount, _reason);
    }

    function executeSlashing(uint256 _proposalId) external onlyAuthorized {
        // Implementation for executing approved slashing
        // Move slashed funds to slashing pool for redistribution
    }

    // --- CROSS-CHAIN GOVERNANCE ---
    function createCrossChainProposal(
        string memory _descriptionHash,
        address payable _recipient,
        uint256 _amount,
        uint256[] memory _targetChainIds
    ) external payable returns (uint256) {
        uint256 proposalId = _createSingleProposal(_descriptionHash, _recipient, _amount);
        
        CrossChainProposal storage ccProposal = crossChainProposals[proposalId];
        ccProposal.localProposalId = proposalId;
        ccProposal.chainIds = _targetChainIds;
        
        emit CrossChainProposalCreated(proposalId, _targetChainIds);
        return proposalId;
    }

    // --- INTERNAL HELPER FUNCTIONS ---
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
        
        // Bonus voting power: 1 per NFT, capped at 10
        return nftCount > 10 ? 10 : nftCount;
    }

    function _calculateConvictionDecay(address _voter, uint256 _proposalId) internal view returns (uint256) {
        ConvictionVoting storage cv = convictionVotes[_proposalId];
        uint256 lastVote = cv.lastVoteTime[_voter];
        
        if (lastVote == 0) return 0;
        
        uint256 timePassed = block.timestamp - lastVote;
        uint256 decayFactor = timePassed / 1 days; // Decay per day
        uint256 currentConviction = cv.conviction[_voter];
        
        // Simple linear decay - can be made more sophisticated
        return currentConviction > decayFactor ? currentConviction - decayFactor : 0;
    }

    function _calculateStakeMultiplier(uint256 _lockDays) internal pure returns (uint256) {
        if (_lockDays >= 365) return 5;
        if (_lockDays >= 180) return 3;
        if (_lockDays >= 90) return 2;
        return 1;
    }

    function _calculateStakingRewards(address _member) internal view returns (uint256) {
        StakingInfo storage stake = memberStaking[_member];
        uint256 stakingDuration = block.timestamp - (stake.lockEndTime - (365 days));
        uint256 annualRate = 5; // 5% APY
        
        return (stake.stakedAmount * annualRate * stakingDuration) / (100 * 365 days);
    }

    function _castVoteInternal(
        uint256 _proposalId,
        bool _support,
        uint256 _credits,
        address _voter
    ) internal {
        // Implementation similar to existing castQuadraticVote but for internal use
        // This enables gasless voting functionality
    }

    function _executeConvictionProposal(uint256 _proposalId) internal {
        // Execute proposal that reached conviction threshold
        Proposal storage p = proposals[_proposalId];
        p.state = ProposalState.Succeeded;
        // Additional execution logic
    }

    function _createSlashingProposal(
        address _member,
        uint256 _amount,
        string memory _reason
    ) internal returns (uint256) {
        // Create a special governance proposal for slashing
        // This would follow similar pattern to regular proposals
        return 0; // Placeholder
    }

    // --- ADVANCED VIEW FUNCTIONS ---
    function getReputationScore(address _member) external view returns (
        uint256 score,
        uint256 successfulProposals,
        uint256 participationRate,
        bool isVerified
    ) {
        ReputationScore memory rep = reputation[_member];
        return (rep.score, rep.successfulProposals, rep.participationRate, rep.isVerified);
    }

    function getPredictionMarketStatus(uint256 _proposalId) external view returns (
        uint256 yesPool,
        uint256 noPool,
        uint256 endTime,
        bool resolved,
        bool outcome
    ) {
        PredictionMarket storage market = predictionMarkets[_proposalId];
        return (market.yesPool, market.noPool, market.endTime, market.resolved, market.outcome);
    }

    function getAIAnalysis(uint256 _proposalId) external view returns (
        uint256 riskScore,
        uint256 impactScore,
        uint256 feasibilityScore,
        string memory summary,
        bool requiresReview
    ) {
        AIAnalysis memory analysis = aiAnalysis[_proposalId];
        return (
            analysis.riskScore,
            analysis.impactScore,
            analysis.feasibilityScore,
            analysis.aiSummary,
            analysis.requiresExpertReview
        );
    }

    // --- ADMIN FUNCTIONS FOR NEW FEATURES ---
    function setAIOracle(address _aiOracle) external onlyOwner {
        aiOracle = _aiOracle;
    }

    function setConvictionThreshold(uint256 _proposalId, uint256 _threshold) external onlyAuthorized {
        convictionVotes[_proposalId].convictionThreshold = _threshold;
    }

    function setProposalVotingType(uint256 _proposalId, VotingMechanism _mechanism) external onlyAuthorized {
        proposalVotingType[_proposalId] = _mechanism;
    }

    // --- EMERGENCY FUNCTIONS ---
    function emergencySlash(address _member, string memory _reason) external onlyOwner {
        // Emergency slashing without proposal process
        StakingInfo storage stake = memberStaking[_member];
        uint256 amount = stake.stakedAmount;
        
        slashingPool += amount;
        totalStaked -= amount;
        delete memberStaking[_member];
        
        emit MemberSlashed(_member, amount, _reason);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title QuadraticDAO
 * @author DAO Development Team
 * @notice A Decentralized Autonomous Organization implementing quadratic voting with delegation
 * @dev This contract uses OpenZeppelin's security patterns for production-grade safety
 * 
 * Security Features:
 * - ReentrancyGuard: Prevents reentrancy attacks on token transfers
 * - Pausable: Allows emergency stops for critical situations
 * - Ownable2Step: Ensures safe ownership transfers
 * 
 * Key Concepts:
 * - Quadratic Voting: Voting power = sqrt(staked tokens)
 * - Delegation: Users can delegate their voting power to others
 * - Proposals: Members can create and vote on governance proposals
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

contract QuadraticDAO is ReentrancyGuard, Pausable, Ownable2Step {
    // ============ State Variables ============
    
    IERC20 public immutable govToken;
    uint256 public proposalCount;
    uint256 public proposalStakeThreshold;
    uint256 public quorumPercentage;
    
    // Constants for validation
    uint256 public constant MAX_DESCRIPTION_LENGTH = 1000;
    uint256 public constant MIN_VOTING_BLOCKS = 100;        // ~20 minutes
    uint256 public constant MAX_VOTING_BLOCKS = 50400;      // ~1 week (assuming 12s blocks)
    uint256 public constant MIN_QUORUM = 1;
    uint256 public constant MAX_QUORUM = 100;
    
    // ============ Structs ============
    
    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        bool finalized;
        bool executed;
        bytes proposalData;
    }

    // ============ Mappings ============
    
    mapping(address => uint256) public stakeOf;
    mapping(address => address) public delegateOf;
    mapping(address => uint256) public delegateWeight;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => bool)) public hasVotedFor;
    mapping(address => bool) public isMember;
    address[] public members;
    uint256 public totalMembers;

    // ============ Events ============
    
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event Delegated(address indexed user, address indexed from, address indexed to);
    event ProposalCreated(uint256 indexed id, address indexed proposer, uint256 startBlock, uint256 endBlock);
    event Voted(uint256 indexed proposalId, address indexed delegate, bool support, uint256 weight);
    event ProposalFinalized(uint256 indexed proposalId, bool passed);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);
    event ThresholdUpdated(uint256 newThreshold);
    event QuorumUpdated(uint256 newQuorumPercentage);
    event MemberAdded(address indexed member);

    // ============ Custom Errors ============
    
    error InvalidAmount();
    error InsufficientStake();
    error InvalidDelegate();
    error AlreadyDelegated();
    error InvalidProposal();
    error VotingClosed();
    error AlreadyVoted();
    error NoDelegatedWeight();
    error VotingStillOpen();
    error AlreadyFinalized();
    error NotFinalized();
    error AlreadyExecuted();
    error ProposalFailed();
    error QuorumNotMet();
    error NotAuthorized();
    error VotingEnded();
    error InvalidQuorum();
    error DescriptionTooLong();
    error InvalidVotingPeriod();
    error TransferFailed();

    // ============ Constructor ============
    
    /**
     * @notice Initializes the DAO with governance token and proposal threshold
     * @param _govToken Address of the ERC20 governance token
     * @param _proposalStakeThreshold Minimum stake required to create proposals
     */
    constructor(IERC20 _govToken, uint256 _proposalStakeThreshold) {
        govToken = _govToken;
        proposalStakeThreshold = _proposalStakeThreshold;
        quorumPercentage = 10;
    }

    // ============ Core Functions ============
    
    /**
     * @notice Calculates integer square root using Newton's method
     * @dev Used for quadratic voting weight calculation
     * @param x The number to calculate square root of
     * @return The integer square root of x
     */
    function _isqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = x;
        uint256 r = 1;
        if (z >> 128 > 0) { z >>= 128; r <<= 64; }
        if (z >> 64 > 0) { z >>= 64; r <<= 32; }
        if (z >> 32 > 0) { z >>= 32; r <<= 16; }
        if (z >> 16 > 0) { z >>= 16; r <<= 8; }
        if (z >> 8 > 0) { z >>= 8; r <<= 4; }
        if (z >> 4 > 0) { z >>= 4; r <<= 2; }
        if (z >> 2 > 0) { r <<= 1; }
        for (uint i = 0; i < 7; i++) {
            r = (r + x / r) >> 1;
        }
        uint256 r1 = x / r;
        return r < r1 ? r : r1;
    }

    /**
     * @notice Stake governance tokens to participate in DAO
     * @dev Automatically makes user a member and calculates quadratic voting weight
     * @param amount Amount of tokens to stake
     */
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        
        if (!govToken.transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }
        
        uint256 oldStake = stakeOf[msg.sender];
        uint256 newStake = oldStake + amount;
        stakeOf[msg.sender] = newStake;
        
        if (!isMember[msg.sender]) {
            isMember[msg.sender] = true;
            members.push(msg.sender);
            totalMembers++;
            emit MemberAdded(msg.sender);
        }
        
        if (delegateOf[msg.sender] == address(0)) {
            delegateOf[msg.sender] = msg.sender;
        }
        
        address del = delegateOf[msg.sender];
        uint256 prevS = _isqrt(oldStake);
        uint256 newS = _isqrt(newStake);
        
        if (newS > prevS) {
            delegateWeight[del] += (newS - prevS);
        }
        
        emit Staked(msg.sender, amount);
    }

    /**
     * @notice Unstake governance tokens from the DAO
     * @dev Updates quadratic voting weight accordingly
     * @param amount Amount of tokens to unstake
     */
    function unstake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        
        uint256 oldStake = stakeOf[msg.sender];
        if (oldStake < amount) revert InsufficientStake();
        
        uint256 newStake = oldStake - amount;
        stakeOf[msg.sender] = newStake;
        
        address del = delegateOf[msg.sender];
        uint256 prevS = _isqrt(oldStake);
        uint256 newS = _isqrt(newStake);
        
        if (prevS > newS) {
            delegateWeight[del] -= (prevS - newS);
        }
        
        if (!govToken.transfer(msg.sender, amount)) {
            revert TransferFailed();
        }
        
        emit Unstaked(msg.sender, amount);
    }

    /**
     * @notice Delegate voting power to another address
     * @dev Transfers quadratic voting weight from current delegate to new delegate
     * @param to Address to delegate voting power to
     */
    function setDelegate(address to) external whenNotPaused {
        if (to == address(0)) revert InvalidDelegate();
        
        address old = delegateOf[msg.sender];
        if (old == address(0)) old = msg.sender;
        if (to == address(0)) to = msg.sender;
        if (old == to) revert AlreadyDelegated();
        
        uint256 s = stakeOf[msg.sender];
        uint256 sqrtS = _isqrt(s);
        
        if (sqrtS > 0) {
            delegateWeight[old] -= sqrtS;
            delegateWeight[to] += sqrtS;
        }
        
        delegateOf[msg.sender] = to;
        emit Delegated(msg.sender, old, to);
    }

    /**
     * @notice Create a new governance proposal
     * @dev Requires minimum stake threshold to prevent spam
     * @param description Proposal description (max 1000 characters)
     * @param votingBlocks Number of blocks for voting period
     * @param proposalData Additional data for proposal execution
     * @return proposalId The ID of the created proposal
     */
    function createProposal(
        string calldata description,
        uint256 votingBlocks,
        bytes calldata proposalData
    ) external whenNotPaused returns (uint256) {
        if (stakeOf[msg.sender] < proposalStakeThreshold) revert InsufficientStake();
        if (bytes(description).length > MAX_DESCRIPTION_LENGTH) revert DescriptionTooLong();
        if (votingBlocks < MIN_VOTING_BLOCKS || votingBlocks > MAX_VOTING_BLOCKS) {
            revert InvalidVotingPeriod();
        }
        
        proposalCount++;
        uint256 start = block.number;
        uint256 end = start + votingBlocks;
        
        proposals[proposalCount] = Proposal({
            id: proposalCount,
            proposer: msg.sender,
            description: description,
            startBlock: start,
            endBlock: end,
            forVotes: 0,
            againstVotes: 0,
            finalized: false,
            executed: false,
            proposalData: proposalData
        });
        
        emit ProposalCreated(proposalCount, msg.sender, start, end);
        return proposalCount;
    }

    /**
     * @notice Vote on a proposal
     * @dev Uses quadratic voting weight based on delegated power
     * @param proposalId ID of the proposal to vote on
     * @param support True for yes, false for no
     */
    function vote(uint256 proposalId, bool support) external whenNotPaused {
        Proposal storage p = proposals[proposalId];
        if (p.id != proposalId || p.startBlock == 0) revert InvalidProposal();
        if (block.number < p.startBlock || block.number > p.endBlock) revert VotingClosed();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();
        
        uint256 weight = delegateWeight[msg.sender];
        if (weight == 0) revert NoDelegatedWeight();
        
        hasVoted[proposalId][msg.sender] = true;
        hasVotedFor[proposalId][msg.sender] = support;
        
        if (support) {
            p.forVotes += weight;
        } else {
            p.againstVotes += weight;
        }
        
        emit Voted(proposalId, msg.sender, support, weight);
    }

    /**
     * @notice Finalize a proposal after voting period ends
     * @dev Calculates if proposal passed based on votes and quorum
     * @param proposalId ID of the proposal to finalize
     */
    function finalizeProposal(uint256 proposalId) external whenNotPaused {
        Proposal storage p = proposals[proposalId];
        if (p.id != proposalId || p.startBlock == 0) revert InvalidProposal();
        if (block.number <= p.endBlock) revert VotingStillOpen();
        if (p.finalized) revert AlreadyFinalized();
        
        p.finalized = true;
        bool passed = p.forVotes > p.againstVotes && _hasQuorum(proposalId);
        
        emit ProposalFinalized(proposalId, passed);
    }
    
    /**
     * @notice Execute a passed proposal
     * @dev Can only execute finalized proposals that passed
     * @param proposalId ID of the proposal to execute
     */
    function executeProposal(uint256 proposalId) external nonReentrant whenNotPaused {
        Proposal storage p = proposals[proposalId];
        if (!p.finalized) revert NotFinalized();
        if (p.executed) revert AlreadyExecuted();
        if (p.forVotes <= p.againstVotes) revert ProposalFailed();
        if (!_hasQuorum(proposalId)) revert QuorumNotMet();
        
        p.executed = true;
        emit ProposalExecuted(proposalId);
    }
    
    /**
     * @notice Cancel a proposal before voting ends
     * @dev Only proposer or owner can cancel
     * @param proposalId ID of the proposal to cancel
     */
    function cancelProposal(uint256 proposalId) external whenNotPaused {
        Proposal storage p = proposals[proposalId];
        if (p.id != proposalId || p.startBlock == 0) revert InvalidProposal();
        if (msg.sender != p.proposer && msg.sender != owner()) revert NotAuthorized();
        if (block.number > p.endBlock) revert VotingEnded();
        if (p.finalized) revert AlreadyFinalized();
        
        p.finalized = true;
        emit ProposalCancelled(proposalId);
    }

    // ============ Admin Functions ============
    
    /**
     * @notice Update the minimum stake required to create proposals
     * @param newThreshold New threshold amount
     */
    function updateProposalThreshold(uint256 newThreshold) external onlyOwner {
        proposalStakeThreshold = newThreshold;
        emit ThresholdUpdated(newThreshold);
    }
    
    /**
     * @notice Update the quorum percentage required for proposals to pass
     * @param newQuorum New quorum percentage (1-100)
     */
    function updateQuorumPercentage(uint256 newQuorum) external onlyOwner {
        if (newQuorum < MIN_QUORUM || newQuorum > MAX_QUORUM) revert InvalidQuorum();
        quorumPercentage = newQuorum;
        emit QuorumUpdated(newQuorum);
    }
    
    /**
     * @notice Pause all contract operations in case of emergency
     * @dev Only owner can pause
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause contract operations
     * @dev Only owner can unpause
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Check if a proposal meets quorum requirements
     * @param proposalId ID of the proposal to check
     * @return bool True if quorum is met
     */
    function _hasQuorum(uint256 proposalId) internal view returns (bool) {
        Proposal storage p = proposals[proposalId];
        uint256 totalVotes = p.forVotes + p.againstVotes;
        uint256 totalWeight = _getTotalDelegateWeight();
        
        if (totalWeight == 0) return false;
        return (totalVotes * 100) / totalWeight >= quorumPercentage;
    }
    
    /**
     * @notice Calculate total voting weight across all members
     * @dev Iterates through members array - gas intensive for large DAOs
     * @return total Total delegate weight
     */
    function _getTotalDelegateWeight() internal view returns (uint256) {
        uint256 total = 0;
        uint256 length = members.length; // Cache array length for gas optimization
        
        for (uint256 i = 0; i < length; i++) {
            total += delegateWeight[members[i]];
        }
        
        return total;
    }

    // ============ View Functions ============
    
    /**
     * @notice Get delegate weight for an address
     * @param who Address to check
     * @return Delegate weight
     */
    function getDelegateWeight(address who) external view returns (uint256) {
        return delegateWeight[who];
    }

    /**
     * @notice Get full proposal details
     * @param id Proposal ID
     * @return Proposal struct
     */
    function getProposal(uint256 id) external view returns (Proposal memory) {
        return proposals[id];
    }
    
    /**
     * @notice Get proposal status information
     * @param id Proposal ID
     * @return isActive True if voting is currently open
     * @return isPassed True if proposal passed
     * @return isExecuted True if proposal was executed
     * @return totalVotes Total number of votes cast
     */
    function getProposalStatus(uint256 id) external view returns (
        bool isActive,
        bool isPassed,
        bool isExecuted,
        uint256 totalVotes
    ) {
        Proposal storage p = proposals[id];
        isActive = block.number >= p.startBlock && block.number <= p.endBlock && !p.finalized;
        isPassed = p.finalized && p.forVotes > p.againstVotes && _hasQuorum(id);
        isExecuted = p.executed;
        totalVotes = p.forVotes + p.againstVotes;
    }
    
    /**
     * @notice Get all proposal IDs
     * @dev Warning: Expensive for large number of proposals, consider pagination
     * @return Array of proposal IDs
     */
    function getAllProposals() external view returns (uint256[] memory) {
        uint256[] memory proposalIds = new uint256[](proposalCount);
        for (uint256 i = 1; i <= proposalCount; i++) {
            proposalIds[i-1] = i;
        }
        return proposalIds;
    }
    
    /**
     * @notice Get total number of DAO members
     * @return Total member count
     */
    function getMemberCount() external view returns (uint256) {
        return totalMembers;
    }
    
    /**
     * @notice Get total amount of tokens staked in the DAO
     * @return Total staked tokens
     */
    function getTotalStaked() external view returns (uint256) {
        return govToken.balanceOf(address(this));
    }
}

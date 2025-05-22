// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title Decentralized Autonomous Organization (DAO) with Quadratic Voting & Delegation
 * @dev A comprehensive DAO implementation featuring quadratic voting mechanisms and delegation capabilities
 */
contract Project is Ownable, ReentrancyGuard {
    using Math for uint256;

    struct Proposal {
        uint256 id;
        string title;
        string description;
        address proposer;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        mapping(address => bool) hasVoted;
        mapping(address => uint256) voterCredits;
    }

    struct Member {
        bool isMember;
        uint256 votingPower;
        address delegate;
        uint256 delegatedPower;
        uint256 joinedAt;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(address => Member) public members;
    mapping(address => address[]) public delegators; // Track who delegated to whom

    uint256 public proposalCounter;
    uint256 public memberCount;
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant MIN_VOTING_POWER = 1;
    uint256 public constant MEMBERSHIP_FEE = 0.01 ether;

    event ProposalCreated(uint256 indexed proposalId, string title, address indexed proposer);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 credits);
    event ProposalExecuted(uint256 indexed proposalId, bool passed);
    event MemberAdded(address indexed member, uint256 votingPower);
    event VotingPowerDelegated(address indexed delegator, address indexed delegate, uint256 power);
    event DelegationRevoked(address indexed delegator, address indexed delegate);

    modifier onlyMember() {
        require(members[msg.sender].isMember, "Only DAO members can perform this action");
        _;
    }

    modifier validProposal(uint256 _proposalId) {
        require(_proposalId < proposalCounter, "Proposal does not exist");
        _;
    }

    constructor() Ownable(msg.sender) {
        // Initialize the DAO with the contract deployer as the first member
        members[msg.sender] = Member({
            isMember: true,
            votingPower: 10,
            delegate: address(0),
            delegatedPower: 0,
            joinedAt: block.timestamp
        });
        memberCount = 1;
        emit MemberAdded(msg.sender, 10);
    }

    /**
     * @dev Core Function 1: Join the DAO as a member with voting power
     * Members pay a fee and receive voting power based on their contribution
     */
    function joinDAO() external payable nonReentrant {
        require(!members[msg.sender].isMember, "Already a DAO member");
        require(msg.value >= MEMBERSHIP_FEE, "Insufficient membership fee");

        // Calculate voting power based on contribution (quadratic relationship)
        uint256 votingPower = Math.sqrt(msg.value / MEMBERSHIP_FEE) + MIN_VOTING_POWER;

        members[msg.sender] = Member({
            isMember: true,
            votingPower: votingPower,
            delegate: address(0),
            delegatedPower: 0,
            joinedAt: block.timestamp
        });

        memberCount++;
        emit MemberAdded(msg.sender, votingPower);
    }

    /**
     * @dev Core Function 2: Create a new proposal for DAO voting
     * Any member can create proposals for the DAO to vote on
     */
    function createProposal(
        string memory _title,
        string memory _description
    ) external onlyMember returns (uint256) {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(bytes(_description).length > 0, "Description cannot be empty");

        uint256 proposalId = proposalCounter++;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.id = proposalId;
        proposal.title = _title;
        proposal.description = _description;
        proposal.proposer = msg.sender;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp + VOTING_PERIOD;
        proposal.executed = false;

        emit ProposalCreated(proposalId, _title, msg.sender);
        return proposalId;
    }

    /**
     * @dev Core Function 3: Cast quadratic votes on proposals with delegation support
     * Implements quadratic voting where cost increases quadratically with vote strength
     */
    function castQuadraticVote(
        uint256 _proposalId,
        bool _support,
        uint256 _credits
    ) external onlyMember validProposal(_proposalId) nonReentrant {
        Proposal storage proposal = proposals[_proposalId];
        
        require(block.timestamp >= proposal.startTime, "Voting has not started");
        require(block.timestamp <= proposal.endTime, "Voting period has ended");
        require(!proposal.hasVoted[msg.sender], "Already voted on this proposal");
        require(_credits > 0, "Credits must be greater than zero");

        // Calculate total available voting power (own + delegated)
        uint256 totalPower = members[msg.sender].votingPower + members[msg.sender].delegatedPower;
        
        // Quadratic voting: cost = credits^2
        uint256 cost = _credits * _credits;
        require(cost <= totalPower, "Insufficient voting power");

        // Calculate vote weight using square root for quadratic voting
        uint256 voteWeight = Math.sqrt(_credits);

        proposal.hasVoted[msg.sender] = true;
        proposal.voterCredits[msg.sender] = _credits;

        if (_support) {
            proposal.forVotes += voteWeight;
        } else {
            proposal.againstVotes += voteWeight;
        }

        emit VoteCast(_proposalId, msg.sender, _support, _credits);
    }

    /**
     * @dev Delegate voting power to another member
     * Allows members to delegate their voting power to trusted representatives
     */
    function delegateVotingPower(address _delegate) external onlyMember {
        require(_delegate != msg.sender, "Cannot delegate to yourself");
        require(members[_delegate].isMember, "Delegate must be a DAO member");
        require(members[msg.sender].delegate == address(0), "Already delegated voting power");

        address previousDelegate = members[msg.sender].delegate;
        if (previousDelegate != address(0)) {
            // Remove from previous delegate
            members[previousDelegate].delegatedPower -= members[msg.sender].votingPower;
            _removeDelegator(previousDelegate, msg.sender);
        }

        members[msg.sender].delegate = _delegate;
        members[_delegate].delegatedPower += members[msg.sender].votingPower;
        delegators[_delegate].push(msg.sender);

        emit VotingPowerDelegated(msg.sender, _delegate, members[msg.sender].votingPower);
    }

    /**
     * @dev Revoke delegation and reclaim voting power
     */
    function revokeDelegation() external onlyMember {
        address delegate = members[msg.sender].delegate;
        require(delegate != address(0), "No active delegation");

        members[delegate].delegatedPower -= members[msg.sender].votingPower;
        members[msg.sender].delegate = address(0);
        _removeDelegator(delegate, msg.sender);

        emit DelegationRevoked(msg.sender, delegate);
    }

    /**
     * @dev Execute a proposal after voting period ends
     */
    function executeProposal(uint256 _proposalId) external validProposal(_proposalId) {
        Proposal storage proposal = proposals[_proposalId];
        
        require(block.timestamp > proposal.endTime, "Voting period not ended");
        require(!proposal.executed, "Proposal already executed");

        proposal.executed = true;
        bool passed = proposal.forVotes > proposal.againstVotes;

        emit ProposalExecuted(_proposalId, passed);
    }

    // View functions
    function getProposal(uint256 _proposalId) external view validProposal(_proposalId) returns (
        string memory title,
        string memory description,
        address proposer,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 startTime,
        uint256 endTime,
        bool executed
    ) {
        Proposal storage proposal = proposals[_proposalId];
        return (
            proposal.title,
            proposal.description,
            proposal.proposer,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.startTime,
            proposal.endTime,
            proposal.executed
        );
    }

    function getMemberInfo(address _member) external view returns (
        bool isMember,
        uint256 votingPower,
        address delegate,
        uint256 delegatedPower,
        uint256 joinedAt
    ) {
        Member storage member = members[_member];
        return (
            member.isMember,
            member.votingPower,
            member.delegate,
            member.delegatedPower,
            member.joinedAt
        );
    }

    function getDelegators(address _delegate) external view returns (address[] memory) {
        return delegators[_delegate];
    }

    // Internal functions
    function _removeDelegator(address _delegate, address _delegator) internal {
        address[] storage delegatorList = delegators[_delegate];
        for (uint256 i = 0; i < delegatorList.length; i++) {
            if (delegatorList[i] == _delegator) {
                delegatorList[i] = delegatorList[delegatorList.length - 1];
                delegatorList.pop();
                break;
            }
        }
    }

    // Allow contract to receive Ether
    receive() external payable {}

    // Withdraw function for DAO treasury (only owner)
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}

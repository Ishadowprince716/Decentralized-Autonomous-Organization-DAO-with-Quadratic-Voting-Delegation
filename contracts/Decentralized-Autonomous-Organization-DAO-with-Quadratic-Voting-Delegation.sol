// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title Advanced Decentralized Autonomous Organization (DAO)
 * @dev An enhanced DAO with proposal deposits, treasury management, quadratic voting, and delegation.
 */
contract Project is Ownable, ReentrancyGuard {
    using Math for uint256;

    // --- Structs ---
    struct Proposal {
        uint256 id;
        string title;
        string description;
        address proposer;
        payable recipient; // For funding proposals
        uint256 amount;      // Amount to transfer for funding proposals
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

    // --- Mappings ---
    mapping(uint256 => Proposal) public proposals;
    mapping(address => Member) public members;
    mapping(address => address[]) public delegators;

    // --- State Variables ---
    uint256 public proposalCounter;
    uint256 public memberCount;

    // --- Governance Parameters ---
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant MIN_VOTING_POWER = 1;
    uint256 public constant MEMBERSHIP_FEE = 0.01 ether;
    uint256 public proposalDeposit = 0.1 ether; // NEW: Deposit to create a proposal
    uint256 public quorumVotes = 10; // NEW: Minimum total votes for a proposal to be valid
    uint256 public passingThresholdPercent = 51; // NEW: e.g., 51 for >50% approval

    // --- Events ---
    event ProposalCreated(uint256 indexed proposalId, string title, address indexed proposer, address recipient, uint256 amount);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 credits);
    event ProposalExecuted(uint256 indexed proposalId, bool passed);
    event MemberAdded(address indexed member, uint256 votingPower);
    event VotingPowerDelegated(address indexed delegator, address indexed delegate, uint256 power);
    event DelegationRevoked(address indexed delegator, address indexed delegate);
    event GovernanceParametersUpdated(uint256 newDeposit, uint256 newQuorum, uint256 newThreshold);


    // --- Modifiers ---
    modifier onlyMember() {
        require(members[msg.sender].isMember, "Only DAO members can perform this action");
        _;
    }

    modifier validProposal(uint256 _proposalId) {
        require(_proposalId < proposalCounter, "Proposal does not exist");
        _;
    }

    constructor() Ownable(msg.sender) {
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

    function joinDAO() external payable nonReentrant {
        require(!members[msg.sender].isMember, "Already a DAO member");
        require(msg.value >= MEMBERSHIP_FEE, "Insufficient membership fee");
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
     * @dev UPDATED: Create a proposal with a deposit, potentially for funding.
     */
    function createProposal(
        string memory _title,
        string memory _description,
        payable _recipient, // address(0) for general proposals
        uint256 _amount      // 0 for general proposals
    ) external payable onlyMember returns (uint256) {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(msg.value == proposalDeposit, "Incorrect proposal deposit amount");
        if (_amount > 0) {
            require(_recipient != address(0), "Recipient cannot be zero address for funding");
            require(address(this).balance >= _amount + proposalDeposit, "Insufficient treasury for proposal amount");
        }

        uint256 proposalId = proposalCounter++;
        Proposal storage p = proposals[proposalId];
        p.id = proposalId;
        p.title = _title;
        p.description = _description;
        p.proposer = msg.sender;
        p.recipient = _recipient;
        p.amount = _amount;
        p.startTime = block.timestamp;
        p.endTime = block.timestamp + VOTING_PERIOD;
        emit ProposalCreated(proposalId, _title, msg.sender, _recipient, _amount);
        return proposalId;
    }

    function castQuadraticVote(uint256 _proposalId, bool _support, uint256 _credits) external onlyMember validProposal(_proposalId) nonReentrant {
        Proposal storage p = proposals[_proposalId];
        require(block.timestamp <= p.endTime, "Voting period has ended");
        require(!p.hasVoted[msg.sender], "Already voted on this proposal");
        require(_credits > 0, "Credits must be greater than zero");
        uint256 totalPower = members[msg.sender].votingPower + members[msg.sender].delegatedPower;
        uint256 cost = _credits * _credits;
        require(cost <= totalPower, "Insufficient voting power");

        uint256 voteWeight = Math.sqrt(_credits);
        p.hasVoted[msg.sender] = true;
        p.voterCredits[msg.sender] = _credits;
        if (_support) {
            p.forVotes += voteWeight;
        } else {
            p.againstVotes += voteWeight;
        }
        emit VoteCast(_proposalId, msg.sender, _support, _credits);
    }
    
    /**
     * @dev UPDATED: Execute a proposal, checking quorum and threshold, and handling treasury disbursement.
     */
    function executeProposal(uint256 _proposalId) external validProposal(_proposalId) nonReentrant {
        Proposal storage p = proposals[_proposalId];
        require(block.timestamp > p.endTime, "Voting period not ended");
        require(!p.executed, "Proposal already executed");

        p.executed = true;
        uint256 totalVotes = p.forVotes + p.againstVotes;
        bool passed = false;

        if (totalVotes >= quorumVotes && p.forVotes * 100 / totalVotes > passingThresholdPercent) {
            passed = true;
            // Refund proposer's deposit for a successful proposal
            payable(p.proposer).transfer(proposalDeposit);

            if (p.amount > 0) {
                require(address(this).balance >= p.amount, "Treasury funds insufficient for execution");
                p.recipient.transfer(p.amount);
            }
        }
        // If the proposal fails, the deposit is kept by the treasury.
        emit ProposalExecuted(_proposalId, passed);
    }

    /**
     * @dev NEW: Allows the owner to update key governance parameters.
     */
    function setGovernanceParameters(uint256 _newDeposit, uint256 _newQuorum, uint256 _newThreshold) external onlyOwner {
        require(_newThreshold > 0 && _newThreshold < 100, "Threshold must be between 1-99");
        proposalDeposit = _newDeposit;
        quorumVotes = _newQuorum;
        passingThresholdPercent = _newThreshold;
        emit GovernanceParametersUpdated(_newDeposit, _newQuorum, _newThreshold);
    }
    
    // --- Delegation Functions ---
    function delegateVotingPower(address _delegate) external onlyMember {
        require(_delegate != msg.sender, "Cannot delegate to yourself");
        require(members[_delegate].isMember, "Delegate must be a DAO member");
        require(members[msg.sender].delegate == address(0), "Already delegated");

        members[msg.sender].delegate = _delegate;
        members[_delegate].delegatedPower += members[msg.sender].votingPower;
        delegators[_delegate].push(msg.sender);
        emit VotingPowerDelegated(msg.sender, _delegate, members[msg.sender].votingPower);
    }

    function revokeDelegation() external onlyMember {
        address delegate = members[msg.sender].delegate;
        require(delegate != address(0), "No active delegation");

        members[delegate].delegatedPower -= members[msg.sender].votingPower;
        members[msg.sender].delegate = address(0);
        _removeDelegator(delegate, msg.sender);
        emit DelegationRevoked(msg.sender, delegate);
    }

    // --- View Functions ---
    function getProposal(uint256 _proposalId) external view validProposal(_proposalId) returns (
        string memory title, address proposer, uint256 forVotes, uint256 againstVotes, bool executed,
        address recipient, uint256 amount
    ) {
        Proposal storage p = proposals[_proposalId];
        return (p.title, p.proposer, p.forVotes, p.againstVotes, p.executed, p.recipient, p.amount);
    }
    // ... other view functions from original contract ...

    // --- Internal Functions ---
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

    receive() external payable {}

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}

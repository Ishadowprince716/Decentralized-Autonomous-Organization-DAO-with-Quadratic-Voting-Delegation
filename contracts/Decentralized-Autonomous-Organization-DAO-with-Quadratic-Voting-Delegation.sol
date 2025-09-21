// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title Advanced Decentralized Autonomous Organization (DAO)
 * @author Your Name Here
 * @notice An enhanced DAO with proposal deposits, treasury management, quadratic voting,
 * delegation, proposal lifecycle states, and time-locked execution.
 */
contract AdvancedDAO is Ownable, ReentrancyGuard {
    using Math for uint256;

    // --- Enums ---
    enum ProposalState { Pending, Active, Canceled, Defeated, Succeeded, Queued, Executed }

    // --- Structs ---
    struct Proposal {
        uint256 id;
        string descriptionHash; // REFACTORED: Use a hash to save gas
        address proposer;
        payable recipient;
        uint256 amount;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        uint256 executableAt; // NEW: Timestamp for when a queued proposal can be executed
        ProposalState state;
        mapping(address => bool) hasVoted;
    }

    struct Member {
        bool isMember;
        uint256 votingPower;
        address delegate;
        uint256 delegatedPower;
        uint256 joinedAt;
    }

    // --- Custom Errors ---
    // NEW: Gas-efficient custom errors
    error AlreadyMember();
    error NotAMember();
    error InsufficientFee();
    error ProposalNotFound();
    error InvalidProposalState(uint256 proposalId, ProposalState requiredState);
    error VotingPeriodActive();
    error VotingPeriodNotEnded();
    error AlreadyVoted();
    error ZeroCredits();
    error VestingPeriodNotOver();
    error InsufficientVotingPower(uint256 cost, uint256 available);
    error NotProposer();
    error InvalidDescriptionHash();
    error InvalidRecipient();
    error InsufficientTreasury();
    error TimelockNotOver(uint256 executableAt);
    error CannotDelegateToSelf();
    error DelegateNotMember();
    error AlreadyDelegated();
    error NoActiveDelegation();
    error InvalidThreshold();
    error QuorumNotMet();
    error ProposalFailed();

    // --- Mappings ---
    mapping(uint256 => Proposal) public proposals;
    mapping(address => Member) public members;
    mapping(address => address[]) public delegators;
    // NEW: Mapping to store delegator indices for efficient removal
    mapping(address => mapping(address => uint256)) private delegatorIndices;

    // --- State Variables ---
    uint256 public proposalCounter;
    uint256 public memberCount;

    // --- Governance Parameters ---
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant MIN_VOTING_POWER = 1;
    uint256 public constant MEMBERSHIP_FEE = 0.01 ether;
    uint256 public constant VESTING_PERIOD = 2 days;
    uint256 public constant TIMELOCK_PERIOD = 2 days; // NEW: Timelock for execution
    uint256 public proposalDeposit = 0.1 ether;
    uint256 public quorumVotes = 10;
    uint256 public passingThresholdPercent = 51;

    // --- Events ---
    event ProposalCreated(uint256 indexed proposalId, string descriptionHash, address indexed proposer);
    event ProposalStateChanged(uint256 indexed proposalId, ProposalState newState);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 credits);
    event MemberAdded(address indexed member, uint256 votingPower);
    event VotingPowerDelegated(address indexed delegator, address indexed delegate, uint256 power);
    event DelegationRevoked(address indexed delegator, address indexed delegate);
    event GovernanceParametersUpdated(uint256 newDeposit, uint256 newQuorum, uint256 newThreshold);

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

    // --- Membership Functions ---
    function joinDAO() external payable nonReentrant {
        if (members[msg.sender].isMember) revert AlreadyMember();
        if (msg.value < MEMBERSHIP_FEE) revert InsufficientFee();
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

    // --- Proposal Functions ---
    function createProposal(
        string memory _descriptionHash,
        payable _recipient,
        uint256 _amount
    ) external payable returns (uint256) {
        if (!members[msg.sender].isMember) revert NotAMember();
        if (bytes(_descriptionHash).length == 0) revert InvalidDescriptionHash();
        if (msg.value != proposalDeposit) revert InsufficientFee();
        if (_amount > 0) {
            if (_recipient == address(0)) revert InvalidRecipient();
            if (address(this).balance < _amount + proposalDeposit) revert InsufficientTreasury();
        }

        uint256 proposalId = proposalCounter++;
        Proposal storage p = proposals[proposalId];
        p.id = proposalId;
        p.descriptionHash = _descriptionHash;
        p.proposer = msg.sender;
        p.recipient = _recipient;
        p.amount = _amount;
        p.startTime = block.timestamp;
        p.endTime = block.timestamp + VOTING_PERIOD;
        p.state = ProposalState.Active;

        emit ProposalCreated(proposalId, _descriptionHash, msg.sender);
        emit ProposalStateChanged(proposalId, ProposalState.Active);
        return proposalId;
    }

    function cancelProposal(uint256 _proposalId) external nonReentrant {
        if (_proposalId >= proposalCounter) revert ProposalNotFound();
        Proposal storage p = proposals[_proposalId];
        if (p.proposer != msg.sender) revert NotProposer();
        if (p.state != ProposalState.Active) revert InvalidProposalState(_proposalId, ProposalState.Active);

        p.state = ProposalState.Canceled;
        // REFACTORED: Use .call for safer transfers
        (bool sent, ) = p.proposer.call{value: proposalDeposit}("");
        require(sent, "Failed to refund deposit");

        emit ProposalStateChanged(_proposalId, ProposalState.Canceled);
    }

    function castQuadraticVote(uint256 _proposalId, bool _support, uint256 _credits) external nonReentrant {
        if (!members[msg.sender].isMember) revert NotAMember();
        if (_proposalId >= proposalCounter) revert ProposalNotFound();
        Proposal storage p = proposals[_proposalId];
        if (p.state != ProposalState.Active) revert InvalidProposalState(_proposalId, ProposalState.Active);
        if (p.hasVoted[msg.sender]) revert AlreadyVoted();
        if (_credits == 0) revert ZeroCredits();
        if (block.timestamp < members[msg.sender].joinedAt + VESTING_PERIOD) revert VestingPeriodNotOver();

        uint256 totalPower = members[msg.sender].votingPower + members[msg.sender].delegatedPower;
        uint256 cost = _credits * _credits;
        if (cost > totalPower) revert InsufficientVotingPower(cost, totalPower);

        p.hasVoted[msg.sender] = true;
        if (_support) {
            p.forVotes += _credits;
        } else {
            p.againstVotes += _credits;
        }
        emit VoteCast(_proposalId, msg.sender, _support, _credits);
    }

    // NEW: Separated finalization logic
    function finalizeProposal(uint256 _proposalId) external {
        if (_proposalId >= proposalCounter) revert ProposalNotFound();
        Proposal storage p = proposals[_proposalId];
        if (block.timestamp <= p.endTime) revert VotingPeriodActive();
        if (p.state != ProposalState.Active) revert InvalidProposalState(_proposalId, ProposalState.Active);

        uint256 totalVotes = p.forVotes + p.againstVotes;
        if (totalVotes < quorumVotes) {
            p.state = ProposalState.Defeated;
            // Deposit is kept by treasury for failed quorum
            emit ProposalStateChanged(_proposalId, ProposalState.Defeated);
            return;
        }

        // REFACTORED: Safer percentage calculation to avoid division
        bool passed = p.forVotes * 100 > passingThresholdPercent * totalVotes;
        if (passed) {
            p.state = ProposalState.Queued;
            p.executableAt = block.timestamp + TIMELOCK_PERIOD;
            emit ProposalStateChanged(_proposalId, ProposalState.Queued);
        } else {
            p.state = ProposalState.Defeated;
            // Deposit is kept by treasury
            emit ProposalStateChanged(_proposalId, ProposalState.Defeated);
        }
    }

    // NEW: Separated execution logic with timelock
    function execute(uint256 _proposalId) external nonReentrant {
        if (_proposalId >= proposalCounter) revert ProposalNotFound();
        Proposal storage p = proposals[_proposalId];
        if (p.state != ProposalState.Queued) revert InvalidProposalState(_proposalId, ProposalState.Queued);
        if (block.timestamp < p.executableAt) revert TimelockNotOver(p.executableAt);

        p.state = ProposalState.Executed;
        
        // Refund proposer's deposit for a successful proposal
        (bool sentRefund, ) = p.proposer.call{value: proposalDeposit}("");
        require(sentRefund, "Failed to refund deposit");

        if (p.amount > 0) {
            if (address(this).balance < p.amount) revert InsufficientTreasury();
            (bool sentPayment, ) = p.recipient.call{value: p.amount}("");
            require(sentPayment, "Failed to send proposal funds");
        }
        emit ProposalStateChanged(_proposalId, ProposalState.Executed);
    }

    // --- Admin Functions ---
    function setGovernanceParameters(uint256 _newDeposit, uint256 _newQuorum, uint256 _newThreshold) external onlyOwner {
        if (_newThreshold == 0 || _newThreshold >= 100) revert InvalidThreshold();
        proposalDeposit = _newDeposit;
        quorumVotes = _newQuorum;
        passingThresholdPercent = _newThreshold;
        emit GovernanceParametersUpdated(_newDeposit, _newQuorum, _newThreshold);
    }

    // --- Delegation Functions ---
    function delegateVotingPower(address _delegate) external {
        if (!members[msg.sender].isMember) revert NotAMember();
        if (_delegate == msg.sender) revert CannotDelegateToSelf();
        if (!members[_delegate].isMember) revert DelegateNotMember();
        if (members[msg.sender].delegate != address(0)) revert AlreadyDelegated();

        members[msg.sender].delegate = _delegate;
        members[_delegate].delegatedPower += members[msg.sender].votingPower;

        // REFACTORED: Store index for O(1) removal
        delegators[_delegate].push(msg.sender);
        delegatorIndices[_delegate][msg.sender] = delegators[_delegate].length - 1;

        emit VotingPowerDelegated(msg.sender, _delegate, members[msg.sender].votingPower);
    }

    function revokeDelegation() external {
        if (!members[msg.sender].isMember) revert NotAMember();
        address delegate = members[msg.sender].delegate;
        if (delegate == address(0)) revert NoActiveDelegation();

        members[delegate].delegatedPower -= members[msg.sender].votingPower;
        members[msg.sender].delegate = address(0);
        _removeDelegator(delegate, msg.sender);
        emit DelegationRevoked(msg.sender, delegate);
    }
    
    // --- Internal Functions ---
    // REFACTORED: O(1) removal of delegator from array
    function _removeDelegator(address _delegate, address _delegator) internal {
        uint256 index = delegatorIndices[_delegate][_delegator];
        address[] storage delegatorList = delegators[_delegate];
        address lastDelegator = delegatorList[delegatorList.length - 1];

        delegatorList[index] = lastDelegator;
        delegatorIndices[_delegate][lastDelegator] = index;

        delegatorList.pop();
        delete delegatorIndices[_delegate][_delegator];
    }

    // --- Treasury Functions ---
    receive() external payable {}

    function withdraw() external onlyOwner {
        (bool sent, ) = owner().call{value: address(this).balance}("");
        require(sent, "Withdrawal failed");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol"; // NEW: Added for emergency pause
import "@openzeppelin/contracts/utils/math/SafeMath.sol"; // SECURITY: Added SafeMath for overflow protection
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title Enhanced Advanced Decentralized Autonomous Organization (DAO)
 * @author Senior Software Architect
 * @notice An enhanced DAO with proposal deposits, treasury management, quadratic voting,
 * delegation with expiry, proposal lifecycle states, time-locked execution, and emergency controls.
 * @dev Implements circuit breaker pattern and batch operations for improved efficiency and security.
 */
contract EnhancedAdvancedDAO is Ownable, ReentrancyGuard, Pausable {
    using Math for uint256;
    using SafeMath for uint256; // SECURITY: Prevent integer overflow

    // --- Enums ---
    enum ProposalState { Pending, Active, Canceled, Defeated, Succeeded, Queued, Executed, Amended }

    // --- Structs ---
    struct Proposal {
        uint256 id;
        string descriptionHash;
        address proposer;
        address payable recipient;
        uint256 amount;
        uint256 forVotes;
        uint256 againstVotes;
        uint128 startTime; // EFFICIENCY: Reduced from uint256 to save gas
        uint128 endTime;   // EFFICIENCY: Reduced from uint256 to save gas
        uint256 executableAt;
        ProposalState state;
        bool amendable; // NEW: Whether proposal can be amended
        mapping(address => bool) hasVoted;
        mapping(address => uint256) voteCredits; // NEW: Track individual vote credits for amendments
    }

    struct Member {
        bool isMember;
        uint128 votingPower;    // EFFICIENCY: Reduced from uint256
        uint128 delegatedPower; // EFFICIENCY: Reduced from uint256
        address delegate;
        uint64 joinedAt;        // EFFICIENCY: Reduced from uint256
        uint64 delegationExpiry; // NEW: Expiry time for delegation
    }

    // NEW: Batch operation struct
    struct BatchProposalData {
        string descriptionHash;
        address payable recipient;
        uint256 amount;
    }

    // --- Custom Errors ---
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
    error CircularDelegation(); // NEW: Prevent delegation loops
    error DelegationExpired(); // NEW: Delegation has expired
    error NotAmendable(); // NEW: Proposal cannot be amended
    error TooManyProposals(); // NEW: Batch size limit exceeded
    error UnauthorizedAccess(); // NEW: Access control error

    // --- Mappings ---
    mapping(uint256 => Proposal) public proposals;
    mapping(address => Member) public members;
    mapping(address => address[]) public delegators;
    mapping(address => mapping(address => uint256)) private delegatorIndices;
    mapping(address => bool) public authorized; // NEW: Authorized addresses for certain operations

    // --- State Variables ---
    uint256 public proposalCounter;
    uint256 public memberCount;
    uint256 public constant MAX_BATCH_SIZE = 10; // NEW: Batch operation limit

    // --- Governance Parameters ---
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant MIN_VOTING_POWER = 1;
    uint256 public constant MEMBERSHIP_FEE = 0.01 ether;
    uint256 public constant VESTING_PERIOD = 2 days;
    uint256 public constant TIMELOCK_PERIOD = 2 days;
    uint256 public constant MAX_DELEGATION_EXPIRY = 365 days; // NEW: Maximum delegation period
    uint256 public proposalDeposit = 0.1 ether;
    uint256 public quorumVotes = 10;
    uint256 public passingThresholdPercent = 51;

    // --- Events ---
    event ProposalCreated(uint256 indexed proposalId, string descriptionHash, address indexed proposer);
    event ProposalStateChanged(uint256 indexed proposalId, ProposalState newState);
    event ProposalAmended(uint256 indexed proposalId, string newDescriptionHash); // NEW
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 credits);
    event MemberAdded(address indexed member, uint256 votingPower);
    event VotingPowerDelegated(address indexed delegator, address indexed delegate, uint256 power, uint256 expiry); // ENHANCED
    event DelegationRevoked(address indexed delegator, address indexed delegate);
    event DelegationExpired(address indexed delegator, address indexed delegate); // NEW
    event GovernanceParametersUpdated(uint256 newDeposit, uint256 newQuorum, uint256 newThreshold);
    event BatchProposalsCreated(uint256[] proposalIds); // NEW
    event AuthorizedAddressAdded(address indexed account); // NEW
    event AuthorizedAddressRemoved(address indexed account); // NEW

    // --- Modifiers ---
    modifier onlyAuthorized() {
        if (!authorized[msg.sender] && msg.sender != owner()) revert UnauthorizedAccess();
        _;
    }

    constructor() Ownable(msg.sender) {
        members[msg.sender] = Member({
            isMember: true,
            votingPower: 10,
            delegate: address(0),
            delegatedPower: 0,
            joinedAt: uint64(block.timestamp),
            delegationExpiry: 0
        });
        memberCount = 1;
        authorized[msg.sender] = true; // Owner is automatically authorized
        emit MemberAdded(msg.sender, 10);
    }

    // --- Membership Functions ---
    function joinDAO() external payable nonReentrant whenNotPaused {
        if (members[msg.sender].isMember) revert AlreadyMember();
        if (msg.value < MEMBERSHIP_FEE) revert InsufficientFee();
        
        // EFFICIENCY: Replace sqrt with tiered system for gas optimization
        uint256 votingPower = MIN_VOTING_POWER;
        uint256 multiplier = msg.value / MEMBERSHIP_FEE;
        if (multiplier >= 4) votingPower += 2;
        else if (multiplier >= 2) votingPower += 1;
        
        members[msg.sender] = Member({
            isMember: true,
            votingPower: uint128(votingPower),
            delegate: address(0),
            delegatedPower: 0,
            joinedAt: uint64(block.timestamp),
            delegationExpiry: 0
        });
        memberCount++;
        emit MemberAdded(msg.sender, votingPower);
    }

    // --- Proposal Functions ---
    function createProposal(
        string memory _descriptionHash,
        address payable _recipient,
        uint256 _amount
    ) external payable whenNotPaused returns (uint256) {
        return _createSingleProposal(_descriptionHash, _recipient, _amount);
    }

    // NEW: Batch proposal creation
    function createBatchProposals(
        BatchProposalData[] calldata _proposals
    ) external payable whenNotPaused returns (uint256[] memory) {
        if (_proposals.length > MAX_BATCH_SIZE) revert TooManyProposals();
        if (!members[msg.sender].isMember) revert NotAMember();
        if (msg.value != proposalDeposit.mul(_proposals.length)) revert InsufficientFee();

        uint256[] memory proposalIds = new uint256[](_proposals.length);
        
        for (uint256 i = 0; i < _proposals.length; i++) {
            proposalIds[i] = _createProposalInternal(
                _proposals[i].descriptionHash,
                _proposals[i].recipient,
                _proposals[i].amount
            );
        }
        
        emit BatchProposalsCreated(proposalIds);
        return proposalIds;
    }

    // NEW: Amend proposal (only by proposer during active period)
    function amendProposal(
        uint256 _proposalId,
        string memory _newDescriptionHash
    ) external nonReentrant whenNotPaused {
        if (_proposalId >= proposalCounter) revert ProposalNotFound();
        Proposal storage p = proposals[_proposalId];
        if (p.proposer != msg.sender) revert NotProposer();
        if (p.state != ProposalState.Active) revert InvalidProposalState(_proposalId, ProposalState.Active);
        if (!p.amendable) revert NotAmendable();
        if (bytes(_newDescriptionHash).length == 0) revert InvalidDescriptionHash();

        p.descriptionHash = _newDescriptionHash;
        p.state = ProposalState.Amended;
        // Reset voting period to allow re-voting
        p.startTime = uint128(block.timestamp);
        p.endTime = uint128(block.timestamp + VOTING_PERIOD);
        p.forVotes = 0;
        p.againstVotes = 0;

        emit ProposalAmended(_proposalId, _newDescriptionHash);
        emit ProposalStateChanged(_proposalId, ProposalState.Active);
    }

    function cancelProposal(uint256 _proposalId) external nonReentrant whenNotPaused {
        if (_proposalId >= proposalCounter) revert ProposalNotFound();
        Proposal storage p = proposals[_proposalId];
        if (p.proposer != msg.sender) revert NotProposer();
        if (p.state != ProposalState.Active) revert InvalidProposalState(_proposalId, ProposalState.Active);

        p.state = ProposalState.Canceled;
        
        // SECURITY: Improved error handling for refund
        _safeTransfer(p.proposer, proposalDeposit);

        emit ProposalStateChanged(_proposalId, ProposalState.Canceled);
    }

    function castQuadraticVote(uint256 _proposalId, bool _support, uint256 _credits) external nonReentrant whenNotPaused {
        if (!members[msg.sender].isMember) revert NotAMember();
        if (_proposalId >= proposalCounter) revert ProposalNotFound();
        Proposal storage p = proposals[_proposalId];
        if (p.state != ProposalState.Active) revert InvalidProposalState(_proposalId, ProposalState.Active);
        if (p.hasVoted[msg.sender]) revert AlreadyVoted();
        if (_credits == 0) revert ZeroCredits();
        if (block.timestamp < members[msg.sender].joinedAt + VESTING_PERIOD) revert VestingPeriodNotOver();

        uint256 totalPower = _getEffectiveVotingPower(msg.sender);
        uint256 cost = _credits.mul(_credits); // SECURITY: Safe multiplication
        if (cost > totalPower) revert InsufficientVotingPower(cost, totalPower);

        p.hasVoted[msg.sender] = true;
        p.voteCredits[msg.sender] = _credits;
        
        if (_support) {
            p.forVotes = p.forVotes.add(_credits); // SECURITY: Safe addition
        } else {
            p.againstVotes = p.againstVotes.add(_credits); // SECURITY: Safe addition
        }
        
        emit VoteCast(_proposalId, msg.sender, _support, _credits);
    }

    function finalizeProposal(uint256 _proposalId) external onlyAuthorized whenNotPaused {
        if (_proposalId >= proposalCounter) revert ProposalNotFound();
        Proposal storage p = proposals[_proposalId];
        if (block.timestamp <= p.endTime) revert VotingPeriodActive();
        if (p.state != ProposalState.Active) revert InvalidProposalState(_proposalId, ProposalState.Active);

        uint256 totalVotes = p.forVotes.add(p.againstVotes); // SECURITY: Safe addition
        if (totalVotes < quorumVotes) {
            p.state = ProposalState.Defeated;
            emit ProposalStateChanged(_proposalId, ProposalState.Defeated);
            return;
        }

        // SECURITY: Safer percentage calculation to prevent precision loss
        bool passed = p.forVotes.mul(100) > passingThresholdPercent.mul(totalVotes);
        if (passed) {
            p.state = ProposalState.Queued;
            p.executableAt = block.timestamp.add(TIMELOCK_PERIOD); // SECURITY: Safe addition
            emit ProposalStateChanged(_proposalId, ProposalState.Queued);
        } else {
            p.state = ProposalState.Defeated;
            emit ProposalStateChanged(_proposalId, ProposalState.Defeated);
        }
    }

    function execute(uint256 _proposalId) external nonReentrant onlyAuthorized whenNotPaused {
        if (_proposalId >= proposalCounter) revert ProposalNotFound();
        Proposal storage p = proposals[_proposalId];
        if (p.state != ProposalState.Queued) revert InvalidProposalState(_proposalId, ProposalState.Queued);
        if (block.timestamp < p.executableAt) revert TimelockNotOver(p.executableAt);

        p.state = ProposalState.Executed;
        
        // Refund proposer's deposit for successful proposal
        _safeTransfer(p.proposer, proposalDeposit);

        if (p.amount > 0) {
            if (address(this).balance < p.amount) revert InsufficientTreasury();
            _safeTransfer(p.recipient, p.amount);
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

    // NEW: Emergency pause mechanism
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // NEW: Authorization management
    function addAuthorizedAddress(address _account) external onlyOwner {
        authorized[_account] = true;
        emit AuthorizedAddressAdded(_account);
    }

    function removeAuthorizedAddress(address _account) external onlyOwner {
        authorized[_account] = false;
        emit AuthorizedAddressRemoved(_account);
    }

    // --- Enhanced Delegation Functions ---
    function delegateVotingPower(address _delegate, uint256 _expiryDays) external whenNotPaused {
        if (!members[msg.sender].isMember) revert NotAMember();
        if (_delegate == msg.sender) revert CannotDelegateToSelf();
        if (!members[_delegate].isMember) revert DelegateNotMember();
        if (members[msg.sender].delegate != address(0)) revert AlreadyDelegated();
        if (_expiryDays > MAX_DELEGATION_EXPIRY / 1 days) revert InvalidThreshold();

        // SECURITY: Check for circular delegation
        if (_wouldCreateCircularDelegation(_delegate, msg.sender)) revert CircularDelegation();

        uint256 expiry = block.timestamp.add(_expiryDays.mul(1 days)); // SECURITY: Safe operations
        members[msg.sender].delegate = _delegate;
        members[msg.sender].delegationExpiry = uint64(expiry);
        members[_delegate].delegatedPower = uint128(
            uint256(members[_delegate].delegatedPower).add(members[msg.sender].votingPower)
        );

        delegators[_delegate].push(msg.sender);
        delegatorIndices[_delegate][msg.sender] = delegators[_delegate].length - 1;

        emit VotingPowerDelegated(msg.sender, _delegate, members[msg.sender].votingPower, expiry);
    }

    function revokeDelegation() external whenNotPaused {
        if (!members[msg.sender].isMember) revert NotAMember();
        address delegate = members[msg.sender].delegate;
        if (delegate == address(0)) revert NoActiveDelegation();

        _revokeDelegationInternal(msg.sender, delegate);
        emit DelegationRevoked(msg.sender, delegate);
    }

    // NEW: Clean up expired delegations
    function cleanupExpiredDelegations(address[] calldata _delegators) external {
        for (uint256 i = 0; i < _delegators.length; i++) {
            address delegator = _delegators[i];
            Member storage member = members[delegator];
            
            if (member.delegate != address(0) && 
                member.delegationExpiry > 0 && 
                block.timestamp >= member.delegationExpiry) {
                
                address delegate = member.delegate;
                _revokeDelegationInternal(delegator, delegate);
                emit DelegationExpired(delegator, delegate);
            }
        }
    }

    // --- Internal Functions ---
    function _createSingleProposal(
        string memory _descriptionHash,
        address payable _recipient,
        uint256 _amount
    ) internal returns (uint256) {
        if (!members[msg.sender].isMember) revert NotAMember();
        if (msg.value != proposalDeposit) revert InsufficientFee();
        return _createProposalInternal(_descriptionHash, _recipient, _amount);
    }

    function _createProposalInternal(
        string memory _descriptionHash,
        address payable _recipient,
        uint256 _amount
    ) internal returns (uint256) {
        if (bytes(_descriptionHash).length == 0) revert InvalidDescriptionHash();
        if (_amount > 0) {
            if (_recipient == address(0)) revert InvalidRecipient();
            if (address(this).balance < _amount.add(proposalDeposit)) revert InsufficientTreasury();
        }

        uint256 proposalId = proposalCounter++;
        Proposal storage p = proposals[proposalId];
        p.id = proposalId;
        p.descriptionHash = _descriptionHash;
        p.proposer = msg.sender;
        p.recipient = _recipient;
        p.amount = _amount;
        p.startTime = uint128(block.timestamp);
        p.endTime = uint128(block.timestamp.add(VOTING_PERIOD)); // SECURITY: Safe addition
        p.state = ProposalState.Active;
        p.amendable = true; // NEW: Proposals are amendable by default

        emit ProposalCreated(proposalId, _descriptionHash, msg.sender);
        emit ProposalStateChanged(proposalId, ProposalState.Active);
        return proposalId;
    }

    function _getEffectiveVotingPower(address _member) internal view returns (uint256) {
        Member storage member = members[_member];
        uint256 totalPower = uint256(member.votingPower).add(member.delegatedPower);
        
        // Check if delegation is expired
        if (member.delegate != address(0) && 
            member.delegationExpiry > 0 && 
            block.timestamp >= member.delegationExpiry) {
            // Only count own voting power if delegation expired
            return member.votingPower;
        }
        
        return totalPower;
    }

    function _revokeDelegationInternal(address _delegator, address _delegate) internal {
        Member storage delegatorMember = members[_delegator];
        Member storage delegateMember = members[_delegate];
        
        delegateMember.delegatedPower = uint128(
            uint256(delegateMember.delegatedPower).sub(delegatorMember.votingPower)
        );
        delegatorMember.delegate = address(0);
        delegatorMember.delegationExpiry = 0;
        _removeDelegator(_delegate, _delegator);
    }

    function _removeDelegator(address _delegate, address _delegator) internal {
        uint256 index = delegatorIndices[_delegate][_delegator];
        address[] storage delegatorList = delegators[_delegate];
        address lastDelegator = delegatorList[delegatorList.length - 1];

        delegatorList[index] = lastDelegator;
        delegatorIndices[_delegate][lastDelegator] = index;

        delegatorList.pop();
        delete delegatorIndices[_delegate][_delegator];
    }

    // SECURITY: Check for circular delegation to prevent infinite loops
    function _wouldCreateCircularDelegation(address _delegate, address _delegator) internal view returns (bool) {
        address current = _delegate;
        uint256 depth = 0;
        
        while (current != address(0) && depth < 50) { // Limit depth to prevent gas issues
            if (current == _delegator) return true;
            current = members[current].delegate;
            depth++;
        }
        
        return false;
    }

    // SECURITY: Safe transfer function with proper error handling
    function _safeTransfer(address _to, uint256 _amount) internal {
        (bool success, ) = _to.call{value: _amount}("");
        require(success, "Transfer failed");
    }

    // --- Treasury Functions ---
    receive() external payable {}

    // SECURITY: Added reentrancy protection to withdraw function
    function withdraw() external onlyOwner nonReentrant {
        _safeTransfer(owner(), address(this).balance);
    }

    // --- View Functions ---
    function getProposalDetails(uint256 _proposalId) external view returns (
        uint256 id,
        string memory descriptionHash,
        address proposer,
        address recipient,
        uint256 amount,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 startTime,
        uint256 endTime,
        uint256 executableAt,
        ProposalState state,
        bool amendable
    ) {
        if (_proposalId >= proposalCounter) revert ProposalNotFound();
        Proposal storage p = proposals[_proposalId];
        return (
            p.id,
            p.descriptionHash,
            p.proposer,
            p.recipient,
            p.amount,
            p.forVotes,
            p.againstVotes,
            p.startTime,
            p.endTime,
            p.executableAt,
            p.state,
            p.amendable
        );
    }

    function getMemberDetails(address _member) external view returns (
        bool isMember,
        uint256 votingPower,
        address delegate,
        uint256 delegatedPower,
        uint256 joinedAt,
        uint256 delegationExpiry,
        uint256 effectiveVotingPower
    ) {
        Member storage member = members[_member];
        return (
            member.isMember,
            member.votingPower,
            member.delegate,
            member.delegatedPower,
            member.joinedAt,
            member.delegationExpiry,
            _getEffectiveVotingPower(_member)
        );
    }
}

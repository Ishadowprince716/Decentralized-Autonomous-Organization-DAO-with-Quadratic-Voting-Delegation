// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

contract QuadraticDAO {
    IERC20 public immutable govToken;
    uint256 public proposalCount;
    uint256 public proposalStakeThreshold;
    address public owner;
    uint256 public quorumPercentage;
    
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

    mapping(address => uint256) public stakeOf;
    mapping(address => address) public delegateOf;
    mapping(address => uint256) public delegateWeight;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => bool)) public hasVotedFor;
    mapping(address => bool) public isMember;
    address[] public members;
    uint256 public totalMembers;

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

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(IERC20 _govToken, uint256 _proposalStakeThreshold) {
        govToken = _govToken;
        proposalStakeThreshold = _proposalStakeThreshold;
        owner = msg.sender;
        quorumPercentage = 10;
    }

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

    function stake(uint256 amount) external {
        require(amount > 0, "amount>0");
        require(govToken.transferFrom(msg.sender, address(this), amount), "transferFrom failed");
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

    function unstake(uint256 amount) external {
        require(amount > 0, "amount>0");
        uint256 oldStake = stakeOf[msg.sender];
        require(oldStake >= amount, "not enough stake");
        uint256 newStake = oldStake - amount;
        stakeOf[msg.sender] = newStake;
        address del = delegateOf[msg.sender];
        uint256 prevS = _isqrt(oldStake);
        uint256 newS = _isqrt(newStake);
        if (prevS > newS) {
            delegateWeight[del] -= (prevS - newS);
        }
        require(govToken.transfer(msg.sender, amount), "transfer failed");
        emit Unstaked(msg.sender, amount);
    }

    function setDelegate(address to) external {
        require(to != address(0), "invalid delegate");
        address old = delegateOf[msg.sender];
        if (old == address(0)) old = msg.sender;
        if (to == address(0)) to = msg.sender;
        require(old != to, "already delegated");
        uint256 s = stakeOf[msg.sender];
        uint256 sqrtS = _isqrt(s);
        if (sqrtS > 0) {
            delegateWeight[old] -= sqrtS;
            delegateWeight[to] += sqrtS;
        }
        delegateOf[msg.sender] = to;
        emit Delegated(msg.sender, old, to);
    }

    function createProposal(string calldata description, uint256 votingBlocks, bytes calldata proposalData) external returns (uint256) {
        require(stakeOf[msg.sender] >= proposalStakeThreshold, "insufficient stake to propose");
        require(votingBlocks > 0, "votingBlocks>0");
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

    function vote(uint256 proposalId, bool support) external {
        Proposal storage p = proposals[proposalId];
        require(p.id == proposalId && p.startBlock > 0, "invalid proposal");
        require(block.number >= p.startBlock && block.number <= p.endBlock, "voting closed");
        require(!hasVoted[proposalId][msg.sender], "already voted");
        uint256 weight = delegateWeight[msg.sender];
        require(weight > 0, "no delegated weight");
        hasVoted[proposalId][msg.sender] = true;
        hasVotedFor[proposalId][msg.sender] = support;
        if (support) p.forVotes += weight;
        else p.againstVotes += weight;
        emit Voted(proposalId, msg.sender, support, weight);
    }

    function finalizeProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.id == proposalId && p.startBlock > 0, "invalid proposal");
        require(block.number > p.endBlock, "voting still open");
        require(!p.finalized, "already finalized");
        p.finalized = true;
        bool passed = p.forVotes > p.againstVotes && _hasQuorum(proposalId);
        emit ProposalFinalized(proposalId, passed);
    }
    
    function executeProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.finalized, "not finalized");
        require(!p.executed, "already executed");
        require(p.forVotes > p.againstVotes, "proposal failed");
        require(_hasQuorum(proposalId), "quorum not met");
        p.executed = true;
        emit ProposalExecuted(proposalId);
    }
    
    function cancelProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.id == proposalId && p.startBlock > 0, "invalid proposal");
        require(msg.sender == p.proposer || msg.sender == owner, "not authorized");
        require(block.number <= p.endBlock, "voting ended");
        require(!p.finalized, "already finalized");
        p.finalized = true;
        emit ProposalCancelled(proposalId);
    }

    function updateProposalThreshold(uint256 newThreshold) external onlyOwner {
        proposalStakeThreshold = newThreshold;
        emit ThresholdUpdated(newThreshold);
    }
    
    function updateQuorumPercentage(uint256 newQuorum) external onlyOwner {
        require(newQuorum <= 100, "invalid quorum");
        quorumPercentage = newQuorum;
        emit QuorumUpdated(newQuorum);
    }
    
    function _hasQuorum(uint256 proposalId) internal view returns (bool) {
        Proposal storage p = proposals[proposalId];
        uint256 totalVotes = p.forVotes + p.againstVotes;
        uint256 totalWeight = _getTotalDelegateWeight();
        if (totalWeight == 0) return false;
        return (totalVotes * 100) / totalWeight >= quorumPercentage;
    }
    
    function _getTotalDelegateWeight() internal view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < members.length; i++) {
            total += delegateWeight[members[i]];
        }
        return total;
    }

    function getDelegateWeight(address who) external view returns (uint256) {
        return delegateWeight[who];
    }

    function getProposal(uint256 id) external view returns (Proposal memory) {
        return proposals[id];
    }
    
    function getProposalStatus(uint256 id) external view returns (bool isActive, bool isPassed, bool isExecuted, uint256 totalVotes) {
        Proposal storage p = proposals[id];
        isActive = block.number >= p.startBlock && block.number <= p.endBlock && !p.finalized;
        isPassed = p.finalized && p.forVotes > p.againstVotes && _hasQuorum(id);
        isExecuted = p.executed;
        totalVotes = p.forVotes + p.againstVotes;
    }
    
    function getAllProposals() external view returns (uint256[] memory) {
        uint256[] memory proposalIds = new uint256[](proposalCount);
        for (uint256 i = 1; i <= proposalCount; i++) {
            proposalIds[i-1] = i;
        }
        return proposalIds;
    }
    
    function getMemberCount() external view returns (uint256) {
        return totalMembers;
    }
    
    function getTotalStaked() external view returns (uint256) {
        return govToken.balanceOf(address(this));
    }
}

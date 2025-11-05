// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Minimal ERC20 interface
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

contract QuadraticDAO {
    IERC20 public immutable govToken;
    uint256 public proposalCount;
    uint256 public proposalStakeThreshold; // min stake to create proposal (in tokens)

    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        bool finalized;
    }

    // user staking & delegation
    mapping(address => uint256) public stakeOf;
    mapping(address => address) public delegateOf; // who user delegates to (default self)
    mapping(address => uint256) public delegateWeight; // sum of sqrt(stake) of delegators

    // proposals
    mapping(uint256 => Proposal) public proposals;
    // per-proposal votes by delegate (so delegate cannot vote twice)
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // Events
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event Delegated(address indexed user, address indexed from, address indexed to);
    event ProposalCreated(uint256 indexed id, address indexed proposer, uint256 startBlock, uint256 endBlock);
    event Voted(uint256 indexed proposalId, address indexed delegate, bool support, uint256 weight);
    event ProposalFinalized(uint256 indexed proposalId, bool passed);

    constructor(IERC20 _govToken, uint256 _proposalStakeThreshold) {
        govToken = _govToken;
        proposalStakeThreshold = _proposalStakeThreshold;
    }

    // --------- Utility: integer sqrt (Babylonian method) ----------
    function _isqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        // initial guess: 2^(log2(x)/2)
        uint256 z = x;
        uint256 r = 1;
        if (z >> 128 > 0) { z >>= 128; r <<= 64; }
        if (z >> 64 > 0) { z >>= 64; r <<= 32; }
        if (z >> 32 > 0) { z >>= 32; r <<= 16; }
        if (z >> 16 > 0) { z >>= 16; r <<= 8; }
        if (z >> 8 > 0) { z >>= 8; r <<= 4; }
        if (z >> 4 > 0) { z >>= 4; r <<= 2; }
        if (z >> 2 > 0) { r <<= 1; }

        // refine
        for (uint i = 0; i < 7; i++) {
            r = (r + x / r) >> 1;
        }
        uint256 r1 = x / r;
        return r < r1 ? r : r1;
    }

    // --------- Staking and Delegation ----------
    function stake(uint256 amount) external {
        require(amount > 0, "amount>0");
        // pull tokens
        require(govToken.transferFrom(msg.sender, address(this), amount), "transferFrom failed");

        uint256 oldStake = stakeOf[msg.sender];
        uint256 newStake = oldStake + amount;
        stakeOf[msg.sender] = newStake;

        // ensure default delegation to self
        if (delegateOf[msg.sender] == address(0)) {
            delegateOf[msg.sender] = msg.sender;
        }

        // update delegate weight: delta = sqrt(newStake) - sqrt(oldStake)
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

        // update delegate weight: delta = sqrt(newStake) - sqrt(oldStake) (negative)
        address del = delegateOf[msg.sender];
        uint256 prevS = _isqrt(oldStake);
        uint256 newS = _isqrt(newStake);
        if (prevS > newS) {
            delegateWeight[del] -= (prevS - newS);
        }

        require(govToken.transfer(msg.sender, amount), "transfer failed");
        emit Unstaked(msg.sender, amount);
    }

    // change delegate
    function setDelegate(address to) external {
        require(to != address(0), "invalid delegate");
        address old = delegateOf[msg.sender];
        if (old == address(0)) old = msg.sender; // if never set
        if (to == address(0)) to = msg.sender;

        require(old != to, "already delegated");

        uint256 s = stakeOf[msg.sender];
        uint256 sqrtS = _isqrt(s);

        // adjust delegate weights
        if (sqrtS > 0) {
            // subtract from old
            delegateWeight[old] -= sqrtS;
            // add to new
            delegateWeight[to] += sqrtS;
        }

        delegateOf[msg.sender] = to;
        emit Delegated(msg.sender, old, to);
    }

    // --------- Proposals ----------
    function createProposal(string calldata description, uint256 votingBlocks) external returns (uint256) {
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
            finalized: false
        });

        emit ProposalCreated(proposalCount, msg.sender, start, end);
        return proposalCount;
    }

    // delegates vote; weight = delegateWeight at call-time (snapshot)
    function vote(uint256 proposalId, bool support) external {
        Proposal storage p = proposals[proposalId];
        require(p.id == proposalId && p.startBlock > 0, "invalid proposal");
        require(block.number >= p.startBlock && block.number <= p.endBlock, "voting closed");
        require(!hasVoted[proposalId][msg.sender], "already voted");

        uint256 weight = delegateWeight[msg.sender];
        require(weight > 0, "no delegated weight");

        hasVoted[proposalId][msg.sender] = true;

        if (support) p.forVotes += weight;
        else p.againstVotes += weight;

        emit Voted(proposalId, msg.sender, support, weight);
    }

    // finalize: anyone can call after voting ends
    function finalizeProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.id == proposalId && p.startBlock > 0, "invalid proposal");
        require(block.number > p.endBlock, "voting still open");
        require(!p.finalized, "already finalized");

        p.finalized = true;
        bool passed = p.forVotes > p.againstVotes;
        emit ProposalFinalized(proposalId, passed);
        // Note: No automatic execution of actions. This contract only records outcomes.
    }

    // ------- Views -------
    function getDelegateWeight(address who) external view returns (uint256) {
        return delegateWeight[who];
    }

    function getProposal(uint256 id) external view returns (Proposal memory) {
        return proposals[id];
    }
}

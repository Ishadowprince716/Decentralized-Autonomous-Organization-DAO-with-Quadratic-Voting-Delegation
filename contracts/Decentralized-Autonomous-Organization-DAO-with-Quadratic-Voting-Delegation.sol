// --- NEW: REPUTATION HELPER FUNCTIONS ---
    function _updateReputationForVote(address _voter, uint256 _proposalId, bool _support) internal {
        ReputationScore storage rep = reputation[_voter];
        Proposal storage p = proposals[_proposalId];
        uint256 currentScore = rep.score;
        uint256 timeSinceLastUpdate = block.timestamp.sub(rep.lastUpdate);
        
        // Decay score over time
        if (timeSinceLastUpdate > 1 days) {
            rep.score = rep.score.sub(timeSinceLastUpdate.div(1 days));
            if (rep.score < 100) rep.score = 100;
        }

        // Reward for participating
        rep.participationRate = rep.participationRate.add(1);
        rep.score = rep.score.add(1);

        // Reward for aligning with winning side or successful proposals
        if (p.hasEnded && p.passed) {
            if ((_support && p.yesVotes > p.noVotes) || (!_support && p.noVotes > p.yesVotes)) {
                rep.score = rep.score.add(10);
                if (_voter == p.proposer) {
                    rep.successfulProposals = rep.successfulProposals.add(1);
                    rep.score = rep.score.add(50);
                }
            }
        }

        rep.lastUpdate = block.timestamp;
        emit ReputationUpdated(_voter, rep.score, rep.streakCount);
    }

    function _updateReputationForDelegation(address _delegator, address _delegatee) internal {
        ReputationScore storage delegatorRep = reputation[_delegator];
        ReputationScore storage delegateeRep = reputation[_delegatee];
        
        // Reward delegatee for receiving trust
        delegateeRep.delegationTrust = delegateeRep.delegationTrust.add(1);
        delegateeRep.score = delegateeRep.score.add(20);
        delegateeRep.lastUpdate = block.timestamp;

        // Minor score boost for delegator
        delegatorRep.score = delegatorRep.score.add(5);
        delegatorRep.lastUpdate = block.timestamp;
        
        emit ReputationUpdated(_delegator, delegatorRep.score, delegatorRep.streakCount);
        emit ReputationUpdated(_delegatee, delegateeRep.score, delegateeRep.streakCount);
    }

    // --- NEW: TOKEN HOLDER VOTING ---
    IERC20 public governanceToken;

    function setGovernanceToken(address _tokenAddress) external onlyOwner {
        require(address(governanceToken) == address(0), "Token already set");
        governanceToken = IERC20(_tokenAddress);
    }

    function _getGovernanceTokenBalance(address _holder) internal view returns (uint256) {
        if (address(governanceToken) == address(0)) {
            return 0;
        }
        return governanceToken.balanceOf(_holder);
    }

    function voteAsTokenHolder(
        uint256 _proposalId,
        bool _support
    ) external nonReentrant whenNotPaused {
        require(proposalVotingType[_proposalId] == VotingMechanism.TokenHolderVoting, "Not token holder voting");
        require(governanceToken.balanceOf(msg.sender) > 0, "No governance tokens");
        
        _castVoteInternal(_proposalId, _support, governanceToken.balanceOf(msg.sender), msg.sender);
    }

    // --- ENHANCED INTERNAL VOTING LOGIC ---
    function _castVoteInternal(
        uint256 _proposalId,
        bool _support,
        uint256 _credits,
        address _voter
    ) internal {
        Proposal storage p = proposals[_proposalId];
        require(!p.hasEnded, "Proposal has ended");
        require(!p.voters[_voter], "Already voted");

        if (_support) {
            p.yesVotes = p.yesVotes.add(_credits);
        } else {
            p.noVotes = p.noVotes.add(_credits);
        }

        p.voters[_voter] = true;
        
        // Update reputation based on vote
        _updateReputationForVote(_voter, _proposalId, _support);
        
        emit VoteCasted(_voter, _proposalId, _support, _credits);
        
        // Check if proposal quorum/threshold is met
        if (block.timestamp >= p.endTime) {
            _endProposal(_proposalId);
        }
    }
    
    // --- NEW: DELEGATION FUNCTIONS ---
    function delegateVotingPower(address _delegatee, uint256 _expiry) external whenNotPaused {
        require(_delegatee != address(0), "Invalid delegatee");
        require(_delegatee != msg.sender, "Cannot delegate to yourself");
        require(_expiry > block.timestamp, "Expiry must be in the future");
        
        LiquidDemocracy storage ld = liquidDemocracy[1]; // Using a placeholder for now
        require(ld.delegates[msg.sender] == address(0), "Already delegated");
        
        // Ensure no delegation loops
        address current = _delegatee;
        uint256 depth = 0;
        while (ld.delegates[current] != address(0) && depth < ld.maxDelegationDepth) {
            require(ld.delegates[current] != msg.sender, "Delegation loop detected");
            current = ld.delegates[current];
            depth++;
        }
        
        ld.delegates[msg.sender] = _delegatee;
        members[msg.sender].delegationExpiry = uint64(_expiry);
        
        // Transfer voting power
        uint256 votingPower = members[msg.sender].votingPower;
        members[msg.sender].delegatedPower = uint128(votingPower);
        members[msg.sender].votingPower = 0;
        
        _addDelegatedPower(_delegatee, votingPower);
        _updateReputationForDelegation(msg.sender, _delegatee);
    }

    function undelegateVotingPower() external {
        LiquidDemocracy storage ld = liquidDemocracy[1];
        address delegatee = ld.delegates[msg.sender];
        require(delegatee != address(0), "Not delegated");
        
        uint256 delegatedPower = members[msg.sender].delegatedPower;
        
        // Remove voting power from delegatee
        _removeDelegatedPower(delegatee, delegatedPower);
        
        // Restore voting power to delegator
        members[msg.sender].votingPower = uint128(delegatedPower);
        members[msg.sender].delegatedPower = 0;
        members[msg.sender].delegationExpiry = 0;
        delete ld.delegates[msg.sender];
    }

    function _addDelegatedPower(address _delegatee, uint256 _amount) internal {
        members[_delegatee].votingPower += uint128(_amount);
    }

    function _removeDelegatedPower(address _delegatee, uint256 _amount) internal {
        members[_delegatee].votingPower -= uint128(_amount);
    }

    // --- NEW: MULTI-SIG PROPOSALS ---
    function submitMultiSigProposal(
        address[] memory _signers,
        uint256 _requiredSignatures,
        bytes32 _proposalHash
    ) external onlyAuthorized returns (uint256) {
        require(_requiredSignatures > 0 && _requiredSignatures <= _signers.length, "Invalid signature count");
        require(_signers.length > 0, "No signers provided");
        
        uint256 proposalId = proposalCounter++;
        
        MultiSigProposal storage p = multiSigProposals[proposalId];
        p.signers = _signers;
        p.requiredSignatures = _requiredSignatures;
        p.proposalHash = _proposalHash;
        p.expiryTime = block.timestamp.add(7 days);
        
        return proposalId;
    }

    function signMultiSigProposal(uint256 _proposalId) external {
        MultiSigProposal storage p = multiSigProposals[_proposalId];
        require(block.timestamp <= p.expiryTime, "Proposal expired");
        require(!p.hasSigned[msg.sender], "Already signed");
        
        bool isSigner = false;
        for (uint256 i = 0; i < p.signers.length; i++) {
            if (p.signers[i] == msg.sender) {
                isSigner = true;
                break;
            }
        }
        require(isSigner, "Not an authorized signer");
        
        p.hasSigned[msg.sender] = true;
        p.signatureTimestamp[msg.sender] = block.timestamp;
        p.currentSignatures = p.currentSignatures.add(1);
        
        emit MultiSigSigned(_proposalId, msg.sender);
    }

    function executeMultiSigProposal(uint256 _proposalId) external onlyAuthorized {
        MultiSigProposal storage p = multiSigProposals[_proposalId];
        require(p.currentSignatures >= p.requiredSignatures, "Not enough signatures");
        
        // Execution logic goes here
        // For example, trigger a function based on p.proposalHash
        
        emit MultiSigExecuted(_proposalId);
    }

    // --- ENHANCED VOTING ELIGIBILITY CHECK ---
    function _checkVotingEligibility(address _voter, uint256 _proposalId) internal view returns (bool) {
        Proposal storage p = proposals[_proposalId];
        if (p.hasEnded) return false;
        if (p.voters[_voter]) return false;
        
        // Check liquid democracy delegation
        if (liquidDemocracy[1].delegates[_voter] != address(0)) {
            return false; // Cannot vote if you have delegated your power
        }
        
        return true;
    }
    
    // --- NEW: EVENT EMISSIONS ---
    event MultiSigSigned(uint256 indexed proposalId, address indexed signer);
    event MultiSigExecuted(uint256 indexed proposalId);
    event GovernanceTokenSet(address indexed tokenAddress);

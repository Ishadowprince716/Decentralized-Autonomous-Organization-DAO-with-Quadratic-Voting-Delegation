// Enhanced Smart Contract Manager
// js/services/contract-manager.js

import { CONTRACT_CONFIG, ERROR_CODES, GAS_LIMITS, QUADRATIC_VOTING } from '../utils/constants.js';
import { InputValidator } from '../utils/validators.js';

/**
 * Manages smart contract interactions and blockchain operations
 * Enhanced with caching, batch operations, and advanced features
 */
export class ContractManager extends EventTarget {
    constructor(web3Manager) {
        super();
        
        this.web3Manager = web3Manager;
        this.contract = null;
        this.isInitialized = false;
        
        // Rate limiting
        this.rateLimits = new Map();
        
        // Caching layer
        this.cache = new Map();
        this.cacheExpiry = new Map();
        this.CACHE_TTL = 30000; // 30 seconds default
        
        // Transaction queue
        this.txQueue = [];
        this.isProcessingQueue = false;
        
        // Event listeners
        this.eventListeners = new Map();
        
        // Performance metrics
        this.metrics = {
            transactionCount: 0,
            failedTransactions: 0,
            averageGasUsed: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
    }

    /**
     * Initialize contract instance with retry logic
     * @param {number} maxRetries - Maximum retry attempts
     */
    async initialize(maxRetries = 3) {
        let lastError;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                if (!this.web3Manager.isConnected) {
                    throw new Error('Web3 not connected');
                }

                this.contract = new ethers.Contract(
                    CONTRACT_CONFIG.address,
                    CONTRACT_CONFIG.abi,
                    this.web3Manager.signer
                );

                // Verify contract is deployed
                const code = await this.web3Manager.provider.getCode(CONTRACT_CONFIG.address);
                if (code === '0x') {
                    throw new Error('Contract not deployed at specified address');
                }

                this.isInitialized = true;
                
                // Setup event listeners
                this.setupContractEvents();
                
                this.dispatchEvent(new CustomEvent('contract:initialized'));
                
                return { success: true };
            } catch (error) {
                lastError = error;
                console.error(`Initialization attempt ${attempt + 1} failed:`, error);
                
                if (attempt < maxRetries - 1) {
                    await this.delay(1000 * (attempt + 1)); // Exponential backoff
                }
            }
        }
        
        console.error('Failed to initialize contract after retries:', lastError);
        throw lastError;
    }

    /**
     * Setup contract event listeners
     */
    setupContractEvents() {
        if (!this.contract) return;

        // Listen for membership events
        this.contract.on('MemberJoined', (member, contribution, event) => {
            this.handleMemberJoined(member, contribution, event);
        });

        // Listen for proposal events
        this.contract.on('ProposalCreated', (proposalId, proposer, title, event) => {
            this.handleProposalCreated(proposalId, proposer, title, event);
        });

        // Listen for vote events
        this.contract.on('VoteCast', (proposalId, voter, support, votes, event) => {
            this.handleVoteCast(proposalId, voter, support, votes, event);
        });

        // Listen for delegation events
        this.contract.on('DelegateChanged', (delegator, fromDelegate, toDelegate, event) => {
            this.handleDelegateChanged(delegator, fromDelegate, toDelegate, event);
        });
    }

    /**
     * Handle MemberJoined event
     */
    handleMemberJoined(member, contribution, event) {
        this.invalidateCache('memberInfo', member);
        this.invalidateCache('analytics');
        
        this.dispatchEvent(new CustomEvent('member:joined:confirmed', {
            detail: { member, contribution, blockNumber: event.blockNumber }
        }));
    }

    /**
     * Handle ProposalCreated event
     */
    handleProposalCreated(proposalId, proposer, title, event) {
        this.invalidateCache('proposals');
        this.invalidateCache('analytics');
        
        this.dispatchEvent(new CustomEvent('proposal:created:confirmed', {
            detail: { proposalId, proposer, title, blockNumber: event.blockNumber }
        }));
    }

    /**
     * Handle VoteCast event
     */
    handleVoteCast(proposalId, voter, support, votes, event) {
        this.invalidateCache('proposal', proposalId);
        this.invalidateCache('proposals');
        
        this.dispatchEvent(new CustomEvent('vote:cast:confirmed', {
            detail: { proposalId, voter, support, votes, blockNumber: event.blockNumber }
        }));
    }

    /**
     * Handle DelegateChanged event
     */
    handleDelegateChanged(delegator, fromDelegate, toDelegate, event) {
        this.invalidateCache('memberInfo', delegator);
        this.invalidateCache('delegationInfo', delegator);
        
        this.dispatchEvent(new CustomEvent('delegation:changed:confirmed', {
            detail: { delegator, fromDelegate, toDelegate, blockNumber: event.blockNumber }
        }));
    }

    /**
     * Join DAO with membership fee
     * @param {string} membershipFee - Fee amount in ETH
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Transaction result
     */
    async joinDAO(membershipFee, options = {}) {
        try {
            if (!this.isInitialized) {
                throw new Error('Contract not initialized');
            }

            // Validate membership fee
            const validation = InputValidator.validateMembershipFee(membershipFee);
            if (!validation.isValid) {
                throw new Error(validation.error);
            }

            // Check if already a member
            const memberInfo = await this.getMemberInfo(this.web3Manager.userAddress);
            if (memberInfo.isMember) {
                throw new Error('Already a DAO member');
            }

            // Check balance
            const balance = await this.web3Manager.getBalance();
            const value = ethers.utils.parseEther(membershipFee);
            if (balance.lt(value)) {
                throw new Error('Insufficient balance');
            }

            // Estimate gas
            const gasEstimate = await this.estimateGas('joinDAO', [], value);
            const gasLimit = options.gasLimit || gasEstimate.mul(120).div(100); // 20% buffer

            const tx = await this.contract.joinDAO({
                value,
                gasLimit
            });

            this.metrics.transactionCount++;

            // Wait for confirmation
            const receipt = await this.web3Manager.waitForTransaction(tx.hash, options.confirmations);

            // Update metrics
            this.updateGasMetrics(receipt.gasUsed);

            this.dispatchEvent(new CustomEvent('member:joined', {
                detail: { 
                    address: this.web3Manager.userAddress,
                    contribution: membershipFee,
                    txHash: tx.hash,
                    gasUsed: receipt.gasUsed.toString()
                }
            }));

            return {
                success: true,
                txHash: tx.hash,
                receipt,
                gasUsed: receipt.gasUsed.toString()
            };

        } catch (error) {
            this.metrics.failedTransactions++;
            return this.handleContractError(error, 'joinDAO');
        }
    }

    /**
     * Create a new proposal
     * @param {string} title - Proposal title
     * @param {string} description - Proposal description
     * @param {string} category - Proposal category
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Transaction result
     */
    async createProposal(title, description, category, options = {}) {
        try {
            if (!this.isInitialized) {
                throw new Error('Contract not initialized');
            }

            // Rate limiting check
            if (!this.checkRateLimit('createProposal', 5, 3600000)) {
                throw new Error('Rate limit exceeded. Please try again later.');
            }

            // Validate inputs
            const validation = InputValidator.validateProposal({ title, description, category });
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }

            // Check membership
            const memberInfo = await this.getMemberInfo(this.web3Manager.userAddress);
            if (!memberInfo.isMember) {
                throw new Error('Must be a DAO member to create proposals');
            }

            // Prepare transaction
            const fullDescription = `${validation.sanitized.description}\n\nCategory: ${category}`;
            
            // Estimate gas
            const gasEstimate = await this.estimateGas('createProposal', [
                validation.sanitized.title,
                fullDescription
            ]);
            const gasLimit = options.gasLimit || gasEstimate.mul(120).div(100);

            const tx = await this.contract.createProposal(
                validation.sanitized.title,
                fullDescription,
                { gasLimit }
            );

            this.metrics.transactionCount++;

            const receipt = await this.web3Manager.waitForTransaction(tx.hash, options.confirmations);

            this.updateGasMetrics(receipt.gasUsed);

            // Extract proposal ID from logs
            const proposalId = this.extractProposalIdFromReceipt(receipt);

            this.dispatchEvent(new CustomEvent('proposal:created', {
                detail: {
                    proposalId,
                    title: validation.sanitized.title,
                    description: fullDescription,
                    proposer: this.web3Manager.userAddress,
                    txHash: tx.hash,
                    gasUsed: receipt.gasUsed.toString()
                }
            }));

            return {
                success: true,
                proposalId,
                txHash: tx.hash,
                receipt,
                gasUsed: receipt.gasUsed.toString()
            };

        } catch (error) {
            this.metrics.failedTransactions++;
            return this.handleContractError(error, 'createProposal');
        }
    }

    /**
     * Cast a quadratic vote
     * @param {number} proposalId - Proposal ID
     * @param {number} credits - Credits to spend
     * @param {boolean} support - Vote support
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Transaction result
     */
    async castVote(proposalId, credits, support, options = {}) {
        try {
            if (!this.isInitialized) {
                throw new Error('Contract not initialized');
            }

            // Rate limiting check
            if (!this.checkRateLimit('castVote', 10, 60000)) {
                throw new Error('Rate limit exceeded. Please try again later.');
            }

            // Validate parameters
            if (!InputValidator.validateVoteParameters(proposalId, credits, support)) {
                throw new Error('Invalid vote parameters');
            }

            // Check membership
            const memberInfo = await this.getMemberInfo(this.web3Manager.userAddress);
            if (!memberInfo.isMember) {
                throw new Error('Must be a DAO member to vote');
            }

            // Check if proposal exists and is active
            const proposal = await this.getProposal(proposalId);
            if (!proposal) {
                throw new Error('Proposal not found');
            }

            const now = Math.floor(Date.now() / 1000);
            if (proposal.endTime <= now) {
                throw new Error('Voting period has ended');
            }

            // Check if already voted
            if (options.preventDoubleVote) {
                const hasVoted = await this.hasVoted(proposalId, this.web3Manager.userAddress);
                if (hasVoted) {
                    throw new Error('Already voted on this proposal');
                }
            }

            // Handle delegation if specified
            if (options.delegateAddress && InputValidator.validateEthereumAddress(options.delegateAddress)) {
                await this.setDelegate(options.delegateAddress);
            }

            // Estimate gas
            const gasEstimate = await this.estimateGas('castQuadraticVote', [
                proposalId,
                credits,
                support
            ]);
            const gasLimit = options.gasLimit || gasEstimate.mul(120).div(100);

            const tx = await this.contract.castQuadraticVote(
                proposalId,
                credits,
                support,
                { gasLimit }
            );

            this.metrics.transactionCount++;

            const receipt = await this.web3Manager.waitForTransaction(tx.hash, options.confirmations);

            this.updateGasMetrics(receipt.gasUsed);

            const votingPower = QUADRATIC_VOTING.calculatePower(credits);

            this.dispatchEvent(new CustomEvent('vote:cast', {
                detail: {
                    proposalId,
                    credits,
                    support,
                    votingPower,
                    voter: this.web3Manager.userAddress,
                    txHash: tx.hash,
                    gasUsed: receipt.gasUsed.toString()
                }
            }));

            return {
                success: true,
                txHash: tx.hash,
                receipt,
                votingPower,
                gasUsed: receipt.gasUsed.toString()
            };

        } catch (error) {
            this.metrics.failedTransactions++;
            return this.handleContractError(error, 'castVote');
        }
    }

    /**
     * Batch cast votes on multiple proposals
     * @param {Array} votes - Array of {proposalId, credits, support}
     * @returns {Promise<Object>} Batch result
     */
    async batchCastVotes(votes) {
        try {
            if (!this.isInitialized) {
                throw new Error('Contract not initialized');
            }

            if (!Array.isArray(votes) || votes.length === 0) {
                throw new Error('Invalid votes array');
            }

            const results = [];
            const errors = [];

            for (const vote of votes) {
                try {
                    const result = await this.castVote(
                        vote.proposalId,
                        vote.credits,
                        vote.support,
                        vote.options || {}
                    );
                    results.push({ ...vote, result });
                } catch (error) {
                    errors.push({ ...vote, error: error.message });
                }
            }

            return {
                success: errors.length === 0,
                results,
                errors,
                totalVotes: votes.length,
                successfulVotes: results.length
            };

        } catch (error) {
            return this.handleContractError(error, 'batchCastVotes');
        }
    }

    /**
     * Set voting delegate
     * @param {string} delegateAddress - Delegate address
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Transaction result
     */
    async setDelegate(delegateAddress, options = {}) {
        try {
            if (!this.isInitialized) {
                throw new Error('Contract not initialized');
            }

            // Rate limiting check
            if (!this.checkRateLimit('setDelegate', 3, 3600000)) {
                throw new Error('Rate limit exceeded. Please try again later.');
            }

            // Validate address if not revoking delegation
            if (delegateAddress && delegateAddress !== ethers.constants.AddressZero) {
                if (!InputValidator.validateEthereumAddress(delegateAddress)) {
                    throw new Error('Invalid delegate address');
                }
                
                // Prevent self-delegation
                if (delegateAddress.toLowerCase() === this.web3Manager.userAddress.toLowerCase()) {
                    throw new Error('Cannot delegate to yourself');
                }
            }

            // Check membership
            const memberInfo = await this.getMemberInfo(this.web3Manager.userAddress);
            if (!memberInfo.isMember) {
                throw new Error('Must be a DAO member to delegate');
            }

            // Use zero address for revocation
            const address = delegateAddress || ethers.constants.AddressZero;
            
            // Estimate gas
            const gasEstimate = await this.estimateGas('delegate', [address]);
            const gasLimit = options.gasLimit || gasEstimate.mul(120).div(100);

            const tx = await this.contract.delegate(address, { gasLimit });

            this.metrics.transactionCount++;

            const receipt = await this.web3Manager.waitForTransaction(tx.hash, options.confirmations);

            this.updateGasMetrics(receipt.gasUsed);

            const isRevocation = address === ethers.constants.AddressZero;

            this.dispatchEvent(new CustomEvent('delegation:set', {
                detail: {
                    delegator: this.web3Manager.userAddress,
                    delegate: address,
                    isRevocation,
                    txHash: tx.hash,
                    gasUsed: receipt.gasUsed.toString()
                }
            }));

            return {
                success: true,
                txHash: tx.hash,
                receipt,
                isRevocation,
                gasUsed: receipt.gasUsed.toString()
            };

        } catch (error) {
            this.metrics.failedTransactions++;
            return this.handleContractError(error, 'setDelegate');
        }
    }

    /**
     * Execute a passed proposal
     * @param {number} proposalId - Proposal ID
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Transaction result
     */
    async executeProposal(proposalId, options = {}) {
        try {
            if (!this.isInitialized) {
                throw new Error('Contract not initialized');
            }

            // Check if proposal exists
            const proposal = await this.getProposal(proposalId);
            if (!proposal) {
                throw new Error('Proposal not found');
            }

            if (proposal.executed) {
                throw new Error('Proposal already executed');
            }

            const now = Math.floor(Date.now() / 1000);
            if (proposal.endTime > now) {
                throw new Error('Voting period still active');
            }

            // Check if proposal passed
            if (proposal.forVotes.lte(proposal.againstVotes)) {
                throw new Error('Proposal did not pass');
            }

            // Estimate gas
            const gasEstimate = await this.estimateGas('executeProposal', [proposalId]);
            const gasLimit = options.gasLimit || gasEstimate.mul(120).div(100);

            const tx = await this.contract.executeProposal(proposalId, { gasLimit });

            this.metrics.transactionCount++;

            const receipt = await this.web3Manager.waitForTransaction(tx.hash, options.confirmations);

            this.updateGasMetrics(receipt.gasUsed);

            this.dispatchEvent(new CustomEvent('proposal:executed', {
                detail: {
                    proposalId,
                    executor: this.web3Manager.userAddress,
                    txHash: tx.hash,
                    gasUsed: receipt.gasUsed.toString()
                }
            }));

            return {
                success: true,
                txHash: tx.hash,
                receipt,
                gasUsed: receipt.gasUsed.toString()
            };

        } catch (error) {
            this.metrics.failedTransactions++;
            return this.handleContractError(error, 'executeProposal');
        }
    }

    /**
     * Get member information with caching
     * @param {string} address - Member address
     * @param {boolean} useCache - Whether to use cache
     * @returns {Promise<Object>} Member info
     */
    async getMemberInfo(address, useCache = true) {
        try {
            if (!this.isInitialized) {
                throw new Error('Contract not initialized');
            }

            const cacheKey = `memberInfo:${address}`;

            if (useCache) {
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    this.metrics.cacheHits++;
                    return cached;
                }
            }

            this.metrics.cacheMisses++;

            const memberData = await this.contract.members(address);
            
            const memberInfo = {
                isMember: memberData.isMember,
                contribution: memberData.contribution,
                votingPower: memberData.votingPower,
                delegatedTo: memberData.delegatedTo,
                address: address,
                joinedAt: memberData.joinedAt || null,
                lastVoteTime: memberData.lastVoteTime || null
            };

            this.setCache(cacheKey, memberInfo);

            return memberInfo;
        } catch (error) {
            console.error('Failed to get member info:', error);
            return {
                isMember: false,
                contribution: ethers.BigNumber.from(0),
                votingPower: ethers.BigNumber.from(0),
                delegatedTo: ethers.constants.AddressZero,
                address: address
            };
        }
    }

    /**
     * Get proposal information with caching
     * @param {number} proposalId - Proposal ID
     * @param {boolean} useCache - Whether to use cache
     * @returns {Promise<Object>} Proposal info
     */
    async getProposal(proposalId, useCache = true) {
        try {
            if (!this.isInitialized) {
                throw new Error('Contract not initialized');
            }

            const cacheKey = `proposal:${proposalId}`;

            if (useCache) {
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    this.metrics.cacheHits++;
                    return cached;
                }
            }

            this.metrics.cacheMisses++;

            const proposalData = await this.contract.proposals(proposalId);
            
            const proposal = {
                id: proposalId,
                title: proposalData.title,
                description: proposalData.description,
                proposer: proposalData.proposer,
                forVotes: proposalData.forVotes,
                againstVotes: proposalData.againstVotes,
                executed: proposalData.executed,
                endTime: proposalData.endTime,
                createdAt: proposalData.createdAt || null,
                status: this.getProposalStatus(proposalData),
                participation: this.calculateParticipation(proposalData),
                winningChoice: proposalData.forVotes.gt(proposalData.againstVotes) ? 'for' : 'against'
            };

            this.setCache(cacheKey, proposal, 15000); // 15s cache for active proposals

            return proposal;
        } catch (error) {
            console.error('Failed to get proposal:', error);
            return null;
        }
    }

    /**
     * Get all proposals with pagination
     * @param {Object} options - Pagination options
     * @returns {Promise<Object>} Paginated proposals
     */
    async getProposals(options = {}) {
        try {
            if (!this.isInitialized) {
                throw new Error('Contract not initialized');
            }

            const {
                page = 0,
                limit = 10,
                status = null,
                useCache = true
            } = options;

            const cacheKey = `proposals:${page}:${limit}:${status}`;

            if (useCache) {
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    this.metrics.cacheHits++;
                    return cached;
                }
            }

            this.metrics.cacheMisses++;

            const proposalCount = await this.contract.proposalCount();
            const total = proposalCount.toNumber();

            const start = page * limit;
            const end = Math.min(start + limit, total);

            const proposals = [];

            for (let i = start; i < end; i++) {
                const proposal = await this.getProposal(i, useCache);
                if (proposal && (!status || proposal.status === status)) {
                    proposals.push(proposal);
                }
            }

            const result = {
                proposals,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: end < total,
                    hasPrev: page > 0
                }
            };

            this.setCache(cacheKey, result);

            return result;
        } catch (error) {
            console.error('Failed to get proposals:', error);
            return {
                proposals: [],
                pagination: { page: 0, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
            };
        }
    }

    /**
     * Search proposals by title or description
     * @param {string} query - Search query
     * @returns {Promise<Array>} Matching proposals
     */
    async searchProposals(query) {
        try {
            if (!query || query.trim().length < 3) {
                throw new Error('Search query must be at least 3 characters');
            }

            const allProposals = await this.getProposals({ limit: 1000, useCache: false });
            const searchTerm = query.toLowerCase().trim();

            const results = allProposals.proposals.filter(proposal => {
                return proposal.title.toLowerCase().includes(searchTerm) ||
                       proposal.description.toLowerCase().includes(searchTerm);
            });

            return results;
        } catch (error) {
            console.error('Failed to search proposals:', error);
            return [];
        }
    }

    /**
     * Get DAO analytics with enhanced metrics
     * @param {boolean} useCache - Whether to use cache
     * @returns {Promise<Object>} Analytics data
     */
    async getAnalytics(useCache = true) {
        try {
            if (!this.isInitialized) {
                throw new Error('Contract not initialized');
            }

            const cacheKey = 'analytics';

            if (useCache) {
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    this.metrics.cacheHits++;
                    return cached;
                }
            }

            this.metrics.cacheMisses++;

            const [memberCount, proposalCount, treasuryBalance] = await Promise.all([
                this.contract.memberCount(),
                this.contract.proposalCount(),
                this.web3Manager.provider.getBalance(CONTRACT_CONFIG.address)
            ]);

            // Get all proposals for advanced metrics
            const allProposals = await this.getProposals({ limit: 1000, useCache: false });
            const proposals = allProposals.proposals;

            const activeProposals = proposals.filter(p => p.status === 'active').length;
            const executedProposals = proposals.filter(p => p.status === 'executed').length;
            const pendingProposals = proposals.filter(p => p.status === 'pending').length;

            const totalVotes = proposals.reduce((sum, p) => 
                sum + parseInt(p.forVotes) + parseInt(p.againstVotes), 0
            );

            const avgParticipation = proposals.length > 0
                ? proposals.reduce((sum, p) => sum + p.participation, 0) / proposals.length
                : 0;

            const analytics = {
                totalMembers: memberCount.toNumber(),
                totalProposals: proposalCount.toNumber(),
                activeProposals,
                executedProposals,
                pendingProposals,
                totalVotes,
                averageParticipation: avgParticipation.toFixed(2),
                treasuryBalance: ethers.utils.formatEther(treasuryBalance),
                proposals: proposals.slice(0, 10), // Recent 10
                performanceMetrics: { ...this.metrics }
            };

            this.setCache(cacheKey, analytics, 60000); // 1 minute cache

            return analytics;
        } catch (error) {
            console.error('Failed to get analytics:', error);
            return {
                totalMembers: 0,
                totalProposals: 0,
                activeProposals: 0,
                executedProposals: 0,
                pendingProposals: 0,
                totalVotes: 0,
                averageParticipation: '0.00',
                treasuryBalance: '0.0',
                proposals: []
            };
        }
    }

    /**
     * Get delegation information for an address
     * @param {string} address - Address to check
     * @param {boolean} useCache - Whether to use cache
     * @returns {Promise<Object>} Delegation info
     */
    async getDelegationInfo(address, useCache = true) {
        try {
            const cacheKey = `delegationInfo:${address}`;

            if (useCache) {
                const cached = this.getFromCache(cacheKey);
                if (cached) return cached;
            }

            const memberInfo = await this.getMemberInfo(address, useCache);
            
            // Get delegates (members who delegated to this address)
            const delegates = await this.getDelegates(address);

            const delegationInfo = {
                currentDelegate: memberInfo.delegatedTo,
                isDelegating: memberInfo.delegatedTo !== ethers.constants.AddressZero,
                votingPower: memberInfo.votingPower,
                delegateCount: delegates.length,
                delegates: delegates
            };

            this.setCache(cacheKey, delegationInfo);

            return delegationInfo;
        } catch (error) {
            console.error('Failed to get delegation info:', error);
            return {
                currentDelegate: ethers.constants.AddressZero,
                isDelegating: false,
                votingPower: ethers.BigNumber.from(0),
                delegateCount: 0,
                delegates: []
            };
        }
    }

    /**
     * Get members who delegated to an address
     * @param {string} address - Delegate address
     * @returns {Promise<Array>} Array of delegator addresses
     */
    async getDelegates(address) {
        try {
            // This would need to be implemented based on contract events
            // For now, returning empty array
            return [];
        } catch (error) {
            console.error('Failed to get delegates:', error);
            return [];
        }
    }

    /**
     * Check if user has voted on a proposal
     * @param {number} proposalId - Proposal ID
     * @param {string} address - Voter address
     * @returns {Promise<boolean>} Whether user has voted
     */
    async hasVoted(proposalId, address) {
        try {
            if (!this.contract.hasVoted) {
                return false; // Contract doesn't support this check
            }
            
            return await this.contract.hasVoted(proposalId, address);
        } catch (error) {
            console.error('Failed to check vote status:', error);
            return false;
        }
    }

    /**
     * Get voting history for an address
     * @param {string} address - Voter address
     * @returns {Promise<Array>} Array of vote records
     */
    async getVotingHistory(address) {
        try {
            // This would typically use contract events or subgraph
            const cacheKey = `votingHistory:${address}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) return cached;

            // Placeholder implementation - would need VoteCast event filtering
            const history = [];
            this.setCache(cacheKey, history, 120000); // 2 minute cache

            return history;
        } catch (error) {
            console.error('Failed to get voting history:', error);
            return [];
        }
    }

    /**
     * Estimate gas for a contract method
     * @param {string} method - Method name
     * @param {Array} params - Method parameters
     * @param {Object} value - ETH value to send
     * @returns {Promise<BigNumber>} Estimated gas
     */
    async estimateGas(method, params = [], value = null) {
        try {
            const options = value ? { value } : {};
            return await this.contract.estimateGas[method](...params, options);
        } catch (error) {
            console.error(`Failed to estimate gas for ${method}:`, error);
            // Return default gas limit as fallback
            return ethers.BigNumber.from(GAS_LIMITS[method.toUpperCase()] || 300000);
        }
    }

    /**
     * Extract proposal ID from transaction receipt
     * @param {Object} receipt - Transaction receipt
     * @returns {number|null} Proposal ID
     */
    extractProposalIdFromReceipt(receipt) {
        try {
            const proposalCreatedEvent = receipt.events?.find(
                e => e.event === 'ProposalCreated'
            );
            return proposalCreatedEvent?.args?.proposalId?.toNumber() || null;
        } catch (error) {
            console.error('Failed to extract proposal ID:', error);
            return null;
        }
    }

    /**
     * Calculate proposal participation rate
     * @param {Object} proposal - Proposal data
     * @returns {number} Participation percentage
     */
    calculateParticipation(proposal) {
        try {
            const totalVotes = proposal.forVotes.add(proposal.againstVotes);
            if (totalVotes.isZero()) return 0;

            // This would need total voting power from contract
            // For now, calculating based on available data
            return 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Determine proposal status
     * @param {Object} proposal - Proposal data
     * @returns {string} Status
     */
    getProposalStatus(proposal) {
        const now = Math.floor(Date.now() / 1000);
        
        if (proposal.executed) {
            return 'executed';
        }
        
        if (proposal.endTime > now) {
            return 'active';
        }
        
        return 'pending';
    }

    /**
     * Get proposal time remaining
     * @param {Object} proposal - Proposal data
     * @returns {Object} Time remaining object
     */
    getTimeRemaining(proposal) {
        const now = Math.floor(Date.now() / 1000);
        const timeLeft = Math.max(0, proposal.endTime - now);

        const days = Math.floor(timeLeft / 86400);
        const hours = Math.floor((timeLeft % 86400) / 3600);
        const minutes = Math.floor((timeLeft % 3600) / 60);
        const seconds = timeLeft % 60;

        return {
            total: timeLeft,
            days,
            hours,
            minutes,
            seconds,
            formatted: `${days}d ${hours}h ${minutes}m ${seconds}s`,
            isExpired: timeLeft === 0
        };
    }

    /**
     * Check rate limiting
     * @param {string} action - Action name
     * @param {number} limit - Rate limit
     * @param {number} window - Time window in ms
     * @returns {boolean} Whether action is allowed
     */
    checkRateLimit(action, limit, window) {
        const now = Date.now();
        const key = `${action}_${this.web3Manager.userAddress}`;
        
        if (!this.rateLimits.has(key)) {
            this.rateLimits.set(key, []);
        }
        
        const attempts = this.rateLimits.get(key);
        
        // Remove old attempts
        const validAttempts = attempts.filter(timestamp => now - timestamp < window);
        
        if (validAttempts.length >= limit) {
            return false;
        }
        
        validAttempts.push(now);
        this.rateLimits.set(key, validAttempts);
        
        return true;
    }

    /**
     * Get rate limit status
     * @param {string} action - Action name
     * @returns {Object} Rate limit info
     */
    getRateLimitStatus(action) {
        const key = `${action}_${this.web3Manager.userAddress}`;
        const attempts = this.rateLimits.get(key) || [];
        
        const limits = {
            createProposal: { limit: 5, window: 3600000 },
            castVote: { limit: 10, window: 60000 },
            setDelegate: { limit: 3, window: 3600000 }
        };

        const config = limits[action] || { limit: 10, window: 60000 };
        const now = Date.now();
        const validAttempts = attempts.filter(t => now - t < config.window);

        return {
            remaining: Math.max(0, config.limit - validAttempts.length),
            limit: config.limit,
            resetTime: validAttempts.length > 0 
                ? validAttempts[0] + config.window 
                : now
        };
    }

    /**
     * Cache management - Set cache
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {number} ttl - Time to live in ms
     */
    setCache(key, value, ttl = this.CACHE_TTL) {
        this.cache.set(key, value);
        this.cacheExpiry.set(key, Date.now() + ttl);
    }

    /**
     * Cache management - Get from cache
     * @param {string} key - Cache key
     * @returns {*} Cached value or null
     */
    getFromCache(key) {
        if (!this.cache.has(key)) return null;

        const expiry = this.cacheExpiry.get(key);
        if (Date.now() > expiry) {
            this.cache.delete(key);
            this.cacheExpiry.delete(key);
            return null;
        }

        return this.cache.get(key);
    }

    /**
     * Cache management - Invalidate cache
     * @param {string} pattern - Cache key pattern
     * @param {*} id - Optional ID to invalidate specific entry
     */
    invalidateCache(pattern, id = null) {
        if (id !== null) {
            const key = `${pattern}:${id}`;
            this.cache.delete(key);
            this.cacheExpiry.delete(key);
        } else {
            // Invalidate all keys matching pattern
            for (const key of this.cache.keys()) {
                if (key.startsWith(pattern)) {
                    this.cache.delete(key);
                    this.cacheExpiry.delete(key);
                }
            }
        }
    }

    /**
     * Clear all cache
     */
    clearCache() {
        this.cache.clear();
        this.cacheExpiry.clear();
    }

    /**
     * Update gas usage metrics
     * @param {BigNumber} gasUsed - Gas used
     */
    updateGasMetrics(gasUsed) {
        const currentAvg = this.metrics.averageGasUsed;
        const count = this.metrics.transactionCount;
        
        this.metrics.averageGasUsed = Math.floor(
            (currentAvg * (count - 1) + gasUsed.toNumber()) / count
        );
    }

    /**
     * Get performance metrics
     * @returns {Object} Performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            cacheSize: this.cache.size,
            rateLimitEntries: this.rateLimits.size,
            successRate: this.metrics.transactionCount > 0
                ? ((this.metrics.transactionCount - this.metrics.failedTransactions) / 
                   this.metrics.transactionCount * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * Reset performance metrics
     */
    resetMetrics() {
        this.metrics = {
            transactionCount: 0,
            failedTransactions: 0,
            averageGasUsed: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
    }

    /**
     * Handle contract errors with detailed error mapping
     * @param {Error} error - Contract error
     * @param {string} method - Contract method name
     * @returns {Object} Error result
     */
    handleContractError(error, method) {
        console.error(`Contract error in ${method}:`, error);

        let errorCode = ERROR_CODES.CONTRACT_ERROR;
        let message = error.message;
        let details = null;

        // Map specific contract errors
        if (error.message.includes('insufficient funds')) {
            errorCode = ERROR_CODES.INSUFFICIENT_FUNDS;
            message = 'Insufficient funds for this transaction';
        } else if (error.message.includes('user rejected') || error.message.includes('User denied')) {
            errorCode = ERROR_CODES.USER_REJECTED;
            message = 'Transaction rejected by user';
        } else if (error.message.includes('already member')) {
            errorCode = ERROR_CODES.ALREADY_MEMBER;
            message = 'Already a DAO member';
        } else if (error.message.includes('not member')) {
            errorCode = ERROR_CODES.NOT_MEMBER;
            message = 'Must be a DAO member';
        } else if (error.message.includes('gas required exceeds')) {
            errorCode = ERROR_CODES.GAS_LIMIT_EXCEEDED;
            message = 'Transaction requires too much gas';
        } else if (error.message.includes('nonce too low')) {
            errorCode = ERROR_CODES.NONCE_ERROR;
            message = 'Transaction nonce error. Please try again';
        } else if (error.message.includes('replacement fee too low')) {
            errorCode = ERROR_CODES.REPLACEMENT_UNDERPRICED;
            message = 'Replacement transaction underpriced';
        } else if (error.message.includes('network')) {
            errorCode = ERROR_CODES.NETWORK_ERROR;
            message = 'Network error. Please check your connection';
        } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
            errorCode = ERROR_CODES.EXECUTION_REVERTED;
            message = 'Transaction would fail. Please check parameters';
            details = error.error?.message || null;
        }

        this.dispatchEvent(new CustomEvent('contract:error', {
            detail: { error, errorCode, message, method, details }
        }));

        return {
            success: false,
            error: message,
            errorCode,
            details,
            method
        };
    }

    /**
     * Utility: Delay function
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Subscribe to contract events
     * @param {string} eventName - Event name
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribeToEvent(eventName, callback) {
        if (!this.contract) {
            throw new Error('Contract not initialized');
        }

        this.contract.on(eventName, callback);

        // Return unsubscribe function
        return () => {
            this.contract.off(eventName, callback);
        };
    }

    /**
     * Unsubscribe from all contract events
     */
    unsubscribeFromAllEvents() {
        if (this.contract) {
            this.contract.removeAllListeners();
        }
    }

    /**
     * Get contract address
     * @returns {string} Contract address
     */
    getContractAddress() {
        return CONTRACT_CONFIG.address;
    }

    /**
     * Get contract ABI
     * @returns {Array} Contract ABI
     */
    getContractABI() {
        return CONTRACT_CONFIG.abi;
    }

    /**
     * Check if contract is initialized
     * @returns {boolean} Initialization status
     */
    isReady() {
        return this.isInitialized && this.web3Manager.isConnected;
    }

    /**
     * Export contract data for backup
     * @returns {Promise<Object>} Exported data
     */
    async exportData() {
        try {
            const analytics = await this.getAnalytics(false);
            const userAddress = this.web3Manager.userAddress;
            const memberInfo = await this.getMemberInfo(userAddress, false);

            return {
                timestamp: Date.now(),
                userAddress,
                memberInfo,
                analytics,
                metrics: this.getMetrics(),
                version: '1.0'
            };
        } catch (error) {
            console.error('Failed to export data:', error);
            throw error;
        }
    }

    /**
     * Health check
     * @returns {Promise<Object>} Health status
     */
    async healthCheck() {
        const health = {
            isInitialized: this.isInitialized,
            isConnected: this.web3Manager.isConnected,
            contractAddress: CONTRACT_CONFIG.address,
            cacheSize: this.cache.size,
            timestamp: Date.now()
        };

        if (this.isInitialized) {
            try {
                const memberCount = await this.contract.memberCount();
                health.contractAccessible = true;
                health.memberCount = memberCount.toNumber();
            } catch (error) {
                health.contractAccessible = false;
                health.error = error.message;
            }
        }

        return health;
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.unsubscribeFromAllEvents();
        this.contract = null;
        this.isInitialized = false;
        this.rateLimits.clear();
        this.clearCache();
        this.txQueue = [];
        this.isProcessingQueue = false;
    }
}

export default ContractManager;

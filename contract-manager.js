import { CONTRACT_CONFIG, ERROR_CODES, GAS_LIMITS, QUADRATIC_VOTING } from '../utils/constants.js';
import { InputValidator } from '../utils/validators.js';
import { ethers } from 'ethers';

/**
 * Enhanced ContractManager
 * See user-provided version for behavior - this adds defensive checks,
 * better BigNumber handling and small API improvements.
 */
export class ContractManager extends EventTarget {
    constructor(web3Manager, opts = {}) {
        super();

        if (!web3Manager) throw new Error('web3Manager required');

        this.web3Manager = web3Manager;
        this.contract = null;
        this.isInitialized = false;

        // Rate limiting per-address/action
        this.rateLimits = new Map();

        // Caching layer
        this.cache = new Map();
        this.cacheExpiry = new Map();
        this.CACHE_TTL = opts.cacheTTL || 30000; // 30s default

        // Transaction queue (future extension)
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

        // Optional start block for event scanning (used by getDelegates)
        this.startBlock = typeof opts.startBlock === 'number' ? opts.startBlock : 0;

        // Concurrency limit for parallel batch ops (default sequential)
        this.batchConcurrency = Math.max(1, Math.floor(opts.batchConcurrency || 1));
    }

    // ----- Initialization -----
    async initialize(maxRetries = 3) {
        let lastError = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                if (!this.web3Manager?.isConnected) {
                    throw new Error('Web3 not connected');
                }
                const providerOrSigner = this.web3Manager.signer || this.web3Manager.provider;
                this.contract = new ethers.Contract(CONTRACT_CONFIG.address, CONTRACT_CONFIG.abi, providerOrSigner);

                // Verify contract is deployed
                const code = await (this.web3Manager.provider?.getCode?.(CONTRACT_CONFIG.address));
                if (!code || code === '0x') {
                    throw new Error('Contract not deployed at specified address');
                }

                this.isInitialized = true;

                // Setup contract event listeners
                this.setupContractEvents();

                this.dispatchEvent(new CustomEvent('contract:initialized'));

                return { success: true };
            } catch (error) {
                lastError = error;
                console.error(`Initialization attempt ${attempt + 1} failed:`, error);

                if (attempt < maxRetries - 1) {
                    await this.delay(1000 * Math.pow(2, attempt)); // exponential backoff
                }
            }
        }

        console.error('Failed to initialize contract after retries:', lastError);
        throw lastError;
    }

    setupContractEvents() {
        if (!this.contract) return;

        try {
            // remove previous listeners first
            try { this.contract.removeAllListeners(); } catch (e) { /* ignore */ }

            const ifaceEvents = this.contract.interface?.events || {};

            if (ifaceEvents.MemberJoined) {
                this.contract.on('MemberJoined', (member, contribution, event) => {
                    this.handleMemberJoined(member, contribution, event);
                });
            }

            if (ifaceEvents.ProposalCreated) {
                this.contract.on('ProposalCreated', (proposalId, proposer, title, event) => {
                    this.handleProposalCreated(proposalId, proposer, title, event);
                });
            }

            if (ifaceEvents.VoteCast) {
                this.contract.on('VoteCast', (proposalId, voter, support, votes, event) => {
                    this.handleVoteCast(proposalId, voter, support, votes, event);
                });
            }

            if (ifaceEvents.DelegateChanged) {
                this.contract.on('DelegateChanged', (delegator, fromDelegate, toDelegate, event) => {
                    this.handleDelegateChanged(delegator, fromDelegate, toDelegate, event);
                });
            }
        } catch (error) {
            console.warn('Failed to setup event listeners:', error?.message || error);
        }
    }

    // ----- Event handlers -----
    handleMemberJoined(member, contribution, event) {
        this.invalidateCache('memberInfo', member);
        this.invalidateCache('analytics');

        this.dispatchEvent(new CustomEvent('member:joined:confirmed', {
            detail: { member, contribution: contribution?.toString?.(), blockNumber: event?.blockNumber }
        }));
    }

    handleProposalCreated(proposalId, proposer, title, event) {
        this.invalidateCache('proposals');
        this.invalidateCache('analytics');

        this.dispatchEvent(new CustomEvent('proposal:created:confirmed', {
            detail: { proposalId: proposalId?.toString?.(), proposer, title, blockNumber: event?.blockNumber }
        }));
    }

    handleVoteCast(proposalId, voter, support, votes, event) {
        this.invalidateCache('proposal', proposalId?.toString?.());
        this.invalidateCache('proposals');

        this.dispatchEvent(new CustomEvent('vote:cast:confirmed', {
            detail: { proposalId: proposalId?.toString?.(), voter, support, votes: votes?.toString?.(), blockNumber: event?.blockNumber }
        }));
    }

    handleDelegateChanged(delegator, fromDelegate, toDelegate, event) {
        this.invalidateCache('memberInfo', delegator);
        this.invalidateCache('delegationInfo', delegator);

        this.dispatchEvent(new CustomEvent('delegation:changed:confirmed', {
            detail: { delegator, fromDelegate, toDelegate, blockNumber: event?.blockNumber }
        }));
    }

    // ----- DAO actions -----
    async joinDAO(membershipFee, options = {}) {
        try {
            if (!this.isInitialized) throw new Error('Contract not initialized');

            const validation = InputValidator.validateMembershipFee(membershipFee);
            if (!validation.isValid) throw new Error(validation.error);

            const memberInfo = await this.getMemberInfo(this.web3Manager.userAddress);
            if (memberInfo?.isMember) throw new Error('Already a DAO member');

            const balance = await this.web3Manager.getBalance();
            const value = ethers.utils.parseEther(membershipFee.toString());
            if (!balance || balance.lt(value)) throw new Error('Insufficient balance');

            const gasEstimate = await this.estimateGas('joinDAO', [], value);
            const gasLimit = options.gasLimit || gasEstimate.mul(120).div(100);

            if (!this.contract.joinDAO) throw new Error('Contract method joinDAO not available');

            const tx = await this.contract.joinDAO({ value, gasLimit });

            this.metrics.transactionCount++;

            if (typeof this.web3Manager.waitForTransaction !== 'function') {
                // fallback: wait for tx.wait if signer returned transaction response
                const receipt = await tx.wait(options.confirmations || 1);
                this.updateGasMetrics(receipt.gasUsed);
                this.dispatchEvent(new CustomEvent('member:joined', {
                    detail: {
                        address: this.web3Manager.userAddress,
                        contribution: membershipFee,
                        txHash: tx.hash,
                        gasUsed: receipt.gasUsed.toString()
                    }
                }));
                return { success: true, txHash: tx.hash, receipt, gasUsed: receipt.gasUsed.toString() };
            }

            const receipt = await this.web3Manager.waitForTransaction(tx.hash, options.confirmations);
            this.updateGasMetrics(receipt.gasUsed);

            this.dispatchEvent(new CustomEvent('member:joined', {
                detail: {
                    address: this.web3Manager.userAddress,
                    contribution: membershipFee,
                    txHash: tx.hash,
                    gasUsed: receipt.gasUsed.toString()
                }
            }));

            return { success: true, txHash: tx.hash, receipt, gasUsed: receipt.gasUsed.toString() };
        } catch (error) {
            this.metrics.failedTransactions++;
            return this.handleContractError(error, 'joinDAO');
        }
    }

    async createProposal(title, description, category, options = {}) {
        try {
            if (!this.isInitialized) throw new Error('Contract not initialized');

            if (!this.checkRateLimit('createProposal', 5, 3600000)) throw new Error('Rate limit exceeded.');

            const validation = InputValidator.validateProposal({ title, description, category });
            if (!validation.isValid) throw new Error((validation.errors || []).join(', '));

            const memberInfo = await this.getMemberInfo(this.web3Manager.userAddress);
            if (!memberInfo?.isMember) throw new Error('Must be a DAO member to create proposals');

            const fullDescription = `${validation.sanitized.description}\n\nCategory: ${category}`;

            const gasEstimate = await this.estimateGas('createProposal', [validation.sanitized.title, fullDescription]);
            const gasLimit = options.gasLimit || gasEstimate.mul(120).div(100);

            if (!this.contract.createProposal) throw new Error('Contract method createProposal not available');

            const tx = await this.contract.createProposal(validation.sanitized.title, fullDescription, { gasLimit });

            this.metrics.transactionCount++;

            const receipt = await this.web3Manager.waitForTransaction(tx.hash, options.confirmations);

            this.updateGasMetrics(receipt.gasUsed);

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

            return { success: true, proposalId, txHash: tx.hash, receipt, gasUsed: receipt.gasUsed.toString() };
        } catch (error) {
            this.metrics.failedTransactions++;
            return this.handleContractError(error, 'createProposal');
        }
    }

    async castVote(proposalId, credits, support, options = {}) {
        try {
            if (!this.isInitialized) throw new Error('Contract not initialized');

            if (!this.checkRateLimit('castVote', 10, 60000)) throw new Error('Rate limit exceeded.');

            if (!InputValidator.validateVoteParameters(proposalId, credits, support)) throw new Error('Invalid vote parameters');

            const memberInfo = await this.getMemberInfo(this.web3Manager.userAddress);
            if (!memberInfo?.isMember) throw new Error('Must be a DAO member to vote');

            const proposal = await this.getProposal(proposalId);
            if (!proposal) throw new Error('Proposal not found');

            const now = Math.floor(Date.now() / 1000);
            if (proposal.endTime <= now) throw new Error('Voting period has ended');

            if (options.preventDoubleVote) {
                const hasVoted = await this.hasVoted(proposalId, this.web3Manager.userAddress);
                if (hasVoted) throw new Error('Already voted on this proposal');
            }

            if (options.delegateAddress && InputValidator.validateEthereumAddress(options.delegateAddress)) {
                await this.setDelegate(options.delegateAddress);
            }

            const methodName = this.contract.castQuadraticVote ? 'castQuadraticVote' : 'castVote';
            const gasEstimate = await this.estimateGas(methodName, [proposalId, credits, support]);
            const gasLimit = options.gasLimit || gasEstimate.mul(120).div(100);

            if (typeof this.contract[methodName] !== 'function') throw new Error(`${methodName} not available on contract`);

            const tx = await this.contract[methodName](proposalId, credits, support, { gasLimit });

            this.metrics.transactionCount++;

            const receipt = await this.web3Manager.waitForTransaction(tx.hash, options.confirmations);

            this.updateGasMetrics(receipt.gasUsed);

            const votingPower = QUADRATIC_VOTING?.calculatePower ? QUADRATIC_VOTING.calculatePower(credits) : credits;

            this.dispatchEvent(new CustomEvent('vote:cast', {
                detail: { proposalId, credits, support, votingPower, voter: this.web3Manager.userAddress, txHash: tx.hash, gasUsed: receipt.gasUsed.toString() }
            }));

            return { success: true, txHash: tx.hash, receipt, votingPower, gasUsed: receipt.gasUsed.toString() };
        } catch (error) {
            this.metrics.failedTransactions++;
            return this.handleContractError(error, 'castVote');
        }
    }

    // Parallel-aware batch vote with optional concurrency
    async batchCastVotes(votes, opts = { parallel: false }) {
        try {
            if (!this.isInitialized) throw new Error('Contract not initialized');
            if (!Array.isArray(votes) || votes.length === 0) throw new Error('Invalid votes array');

            const results = [];
            const errors = [];

            if (opts.parallel && this.batchConcurrency > 1) {
                // concurrency control using simple slicing approach
                const concurrency = this.batchConcurrency;
                const chunks = [];
                for (let i = 0; i < votes.length; i += concurrency) {
                    chunks.push(votes.slice(i, i + concurrency));
                }

                for (const chunk of chunks) {
                    const settled = await Promise.allSettled(chunk.map(vote => this.castVote(vote.proposalId, vote.credits, vote.support, vote.options || {})));
                    settled.forEach((s, idx) => {
                        if (s.status === 'fulfilled') results.push({ ...chunk[idx], result: s.value });
                        else errors.push({ ...chunk[idx], error: s.reason?.message || String(s.reason) });
                    });
                }
            } else {
                // sequential fallback (safe, respects rate limits)
                for (const vote of votes) {
                    try {
                        const result = await this.castVote(vote.proposalId, vote.credits, vote.support, vote.options || {});
                        results.push({ ...vote, result });
                    } catch (error) {
                        errors.push({ ...vote, error: error?.message || String(error) });
                    }
                }
            }

            return { success: errors.length === 0, results, errors, totalVotes: votes.length, successfulVotes: results.length };
        } catch (error) {
            return this.handleContractError(error, 'batchCastVotes');
        }
    }

    async setDelegate(delegateAddress, options = {}) {
        try {
            if (!this.isInitialized) throw new Error('Contract not initialized');

            if (!this.checkRateLimit('setDelegate', 3, 3600000)) throw new Error('Rate limit exceeded.');

            if (delegateAddress && delegateAddress !== ethers.constants.AddressZero) {
                if (!InputValidator.validateEthereumAddress(delegateAddress)) throw new Error('Invalid delegate address');
                if (delegateAddress.toLowerCase() === this.web3Manager.userAddress.toLowerCase()) throw new Error('Cannot delegate to yourself');
            }

            const memberInfo = await this.getMemberInfo(this.web3Manager.userAddress);
            if (!memberInfo?.isMember) throw new Error('Must be a DAO member to delegate');

            const address = delegateAddress || ethers.constants.AddressZero;

            const gasEstimate = await this.estimateGas('delegate', [address]);
            const gasLimit = options.gasLimit || gasEstimate.mul(120).div(100);

            if (typeof this.contract.delegate !== 'function') throw new Error('delegate not available on contract');

            const tx = await this.contract.delegate(address, { gasLimit });

            this.metrics.transactionCount++;

            const receipt = await this.web3Manager.waitForTransaction(tx.hash, options.confirmations);

            this.updateGasMetrics(receipt.gasUsed);

            const isRevocation = address === ethers.constants.AddressZero;

            this.dispatchEvent(new CustomEvent('delegation:set', {
                detail: { delegator: this.web3Manager.userAddress, delegate: address, isRevocation, txHash: tx.hash, gasUsed: receipt.gasUsed.toString() }
            }));

            return { success: true, txHash: tx.hash, receipt, isRevocation, gasUsed: receipt.gasUsed.toString() };
        } catch (error) {
            this.metrics.failedTransactions++;
            return this.handleContractError(error, 'setDelegate');
        }
    }

    async executeProposal(proposalId, options = {}) {
        try {
            if (!this.isInitialized) throw new Error('Contract not initialized');

            const proposal = await this.getProposal(proposalId);
            if (!proposal) throw new Error('Proposal not found');
            if (proposal.executed) throw new Error('Proposal already executed');

            const now = Math.floor(Date.now() / 1000);
            if (proposal.endTime > now) throw new Error('Voting period still active');

            // ensure forVotes > againstVotes using BigNumber safe compare
            const forVotesBN = ethers.BigNumber.from(proposal.forVotes || 0);
            const againstVotesBN = ethers.BigNumber.from(proposal.againstVotes || 0);
            if (forVotesBN.lte(againstVotesBN)) {
                throw new Error('Proposal did not pass');
            }

            const gasEstimate = await this.estimateGas('executeProposal', [proposalId]);
            const gasLimit = options.gasLimit || gasEstimate.mul(120).div(100);

            if (typeof this.contract.executeProposal !== 'function') throw new Error('executeProposal not available on contract');

            const tx = await this.contract.executeProposal(proposalId, { gasLimit });

            this.metrics.transactionCount++;

            const receipt = await this.web3Manager.waitForTransaction(tx.hash, options.confirmations);

            this.updateGasMetrics(receipt.gasUsed);

            this.dispatchEvent(new CustomEvent('proposal:executed', {
                detail: { proposalId, executor: this.web3Manager.userAddress, txHash: tx.hash, gasUsed: receipt.gasUsed.toString() }
            }));

            return { success: true, txHash: tx.hash, receipt, gasUsed: receipt.gasUsed.toString() };
        } catch (error) {
            this.metrics.failedTransactions++;
            return this.handleContractError(error, 'executeProposal');
        }
    }

    // ----- Reads & caching -----
    async getMemberInfo(address, useCache = true) {
        try {
            if (!this.isInitialized) throw new Error('Contract not initialized');

            const cacheKey = `memberInfo:${address}`;
            if (useCache) {
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    this.metrics.cacheHits++;
                    return cached;
                }
            }

            this.metrics.cacheMisses++;

            if (!this.contract?.members) throw new Error('Contract does not expose members mapping');

            const memberData = await this.contract.members(address);

            const memberInfo = {
                isMember: Boolean(memberData.isMember),
                contribution: memberData.contribution ? ethers.BigNumber.from(memberData.contribution) : ethers.BigNumber.from(0),
                votingPower: memberData.votingPower ? ethers.BigNumber.from(memberData.votingPower) : ethers.BigNumber.from(0),
                delegatedTo: memberData.delegatedTo || ethers.constants.AddressZero,
                address,
                joinedAt: memberData.joinedAt || null,
                lastVoteTime: memberData.lastVoteTime || null
            };

            this.setCache(cacheKey, memberInfo);
            return memberInfo;
        } catch (error) {
            console.error('Failed to get member info:', error?.message || error);
            return {
                isMember: false,
                contribution: ethers.BigNumber.from(0),
                votingPower: ethers.BigNumber.from(0),
                delegatedTo: ethers.constants.AddressZero,
                address
            };
        }
    }

    async getProposal(proposalId, useCache = true) {
        try {
            if (!this.isInitialized) throw new Error('Contract not initialized');

            const cacheKey = `proposal:${proposalId}`;
            if (useCache) {
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    this.metrics.cacheHits++;
                    return cached;
                }
            }

            this.metrics.cacheMisses++;

            if (!this.contract?.proposals) throw new Error('Contract does not expose proposals mapping');

            const proposalData = await this.contract.proposals(proposalId);

            // Normalize numeric / BN fields
            const forVotesBN = proposalData.forVotes ? ethers.BigNumber.from(proposalData.forVotes) : ethers.BigNumber.from(0);
            const againstVotesBN = proposalData.againstVotes ? ethers.BigNumber.from(proposalData.againstVotes) : ethers.BigNumber.from(0);
            const endTimeNum = Number(proposalData.endTime || 0);

            const proposal = {
                id: Number(proposalId),
                title: proposalData.title || '',
                description: proposalData.description || '',
                proposer: proposalData.proposer || null,
                forVotes: forVotesBN,
                againstVotes: againstVotesBN,
                executed: Boolean(proposalData.executed),
                endTime: endTimeNum,
                createdAt: proposalData.createdAt || null,
                status: this.getProposalStatus(proposalData, { endTime: endTimeNum, executed: Boolean(proposalData.executed) }),
                participation: await this.calculateParticipation({ forVotes: forVotesBN, againstVotes: againstVotesBN, endTime: endTimeNum, ...proposalData }),
                winningChoice: forVotesBN.gt(againstVotesBN) ? 'for' : 'against'
            };

            // active proposals cached shorter
            this.setCache(cacheKey, proposal, proposal.executed ? this.CACHE_TTL : 15000);

            return proposal;
        } catch (error) {
            console.error('Failed to get proposal:', error?.message || error);
            return null;
        }
    }

    async getProposals(options = {}) {
        try {
            if (!this.isInitialized) throw new Error('Contract not initialized');

            const { page = 0, limit = 10, status = null, useCache = true } = options;
            const cacheKey = `proposals:${page}:${limit}:${status}`;

            if (useCache) {
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    this.metrics.cacheHits++;
                    return cached;
                }
            }

            this.metrics.cacheMisses++;

            if (!this.contract?.proposalCount) throw new Error('Contract does not expose proposalCount');

            const proposalCountBN = await this.contract.proposalCount();
            const total = Number(proposalCountBN.toString());

            const start = page * limit;
            const end = Math.min(start + limit, total);

            const proposals = [];
            for (let i = start; i < end; i++) {
                const proposal = await this.getProposal(i, useCache);
                if (proposal && (!status || proposal.status === status)) proposals.push(proposal);
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
            console.error('Failed to get proposals:', error?.message || error);
            return { proposals: [], pagination: { page: 0, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
        }
    }

    async searchProposals(query) {
        try {
            if (!query || query.trim().length < 3) throw new Error('Search query must be at least 3 characters');

            const allProposals = await this.getProposals({ limit: 1000, useCache: false });
            const searchTerm = query.toLowerCase().trim();

            const results = allProposals.proposals.filter(p => (p.title || '').toLowerCase().includes(searchTerm) || (p.description || '').toLowerCase().includes(searchTerm));
            return results;
        } catch (error) {
            console.error('Failed to search proposals:', error?.message || error);
            return [];
        }
    }

    async getAnalytics(useCache = true) {
        try {
            if (!this.isInitialized) throw new Error('Contract not initialized');

            const cacheKey = 'analytics';
            if (useCache) {
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    this.metrics.cacheHits++;
                    return cached;
                }
            }

            this.metrics.cacheMisses++;

            const [memberCountBN, proposalCountBN, treasuryBalance] = await Promise.all([
                typeof this.contract.memberCount === 'function' ? this.contract.memberCount() : ethers.BigNumber.from(0),
                typeof this.contract.proposalCount === 'function' ? this.contract.proposalCount() : ethers.BigNumber.from(0),
                this.web3Manager.provider?.getBalance ? this.web3Manager.provider.getBalance(CONTRACT_CONFIG.address) : ethers.BigNumber.from(0)
            ]);

            const allProposals = await this.getProposals({ limit: 1000, useCache: false });
            const proposals = allProposals.proposals;

            const activeProposals = proposals.filter(p => p.status === 'active').length;
            const executedProposals = proposals.filter(p => p.status === 'executed').length;
            const pendingProposals = proposals.filter(p => p.status === 'pending').length;

            const totalVotes = proposals.reduce((sum, p) => {
                const f = p.forVotes ? Number((p.forVotes || 0).toString?.() || p.forVotes) : 0;
                const a = p.againstVotes ? Number((p.againstVotes || 0).toString?.() || p.againstVotes) : 0;
                return sum + f + a;
            }, 0);

            const avgParticipation = proposals.length > 0 ? proposals.reduce((sum, p) => sum + (Number(p.participation) || 0), 0) / proposals.length : 0;

            const analytics = {
                totalMembers: Number(memberCountBN.toString()),
                totalProposals: Number(proposalCountBN.toString()),
                activeProposals,
                executedProposals,
                pendingProposals,
                totalVotes,
                averageParticipation: avgParticipation.toFixed(2),
                treasuryBalance: ethers.utils.formatEther(treasuryBalance || ethers.BigNumber.from(0)),
                proposals: proposals.slice(0, 10),
                performanceMetrics: { ...this.metrics }
            };

            this.setCache(cacheKey, analytics, 60000);
            return analytics;
        } catch (error) {
            console.error('Failed to get analytics:', error?.message || error);
            return { totalMembers: 0, totalProposals: 0, activeProposals: 0, executedProposals: 0, pendingProposals: 0, totalVotes: 0, averageParticipation: '0.00', treasuryBalance: '0.0', proposals: [] };
        }
    }

    async getDelegationInfo(address, useCache = true) {
        try {
            const cacheKey = `delegationInfo:${address}`;
            if (useCache) {
                const cached = this.getFromCache(cacheKey);
                if (cached) return cached;
            }

            const memberInfo = await this.getMemberInfo(address, useCache);
            const delegates = await this.getDelegates(address);

            const delegationInfo = {
                currentDelegate: memberInfo.delegatedTo,
                isDelegating: memberInfo.delegatedTo !== ethers.constants.AddressZero,
                votingPower: memberInfo.votingPower,
                delegateCount: delegates.length,
                delegates
            };

            this.setCache(cacheKey, delegationInfo);
            return delegationInfo;
        } catch (error) {
            console.error('Failed to get delegation info:', error?.message || error);
            return { currentDelegate: ethers.constants.AddressZero, isDelegating: false, votingPower: ethers.BigNumber.from(0), delegateCount: 0, delegates: [] };
        }
    }

    // Attempt to reconstruct delegates by scanning DelegateChanged events between startBlock and latest
    async getDelegates(address) {
        try {
            if (!this.contract) return [];

            // If contract exposes a helper, prefer it
            if (typeof this.contract.getDelegators === 'function') {
                try {
                    return await this.contract.getDelegators(address);
                } catch (e) {
                    console.warn('contract.getDelegators failed, falling back to log scan:', e?.message || e);
                }
            }

            const provider = this.web3Manager.provider;
            if (!provider || typeof provider.getBlockNumber !== 'function' || typeof provider.getLogs !== 'function') return [];

            const latest = await provider.getBlockNumber();

            // Build filter via contract.filters if possible
            const filter = (this.contract.filters && typeof this.contract.filters.DelegateChanged === 'function') ?
                this.contract.filters.DelegateChanged(null, null, null) :
                null;

            // If no filter helper, construct topic-based filter
            let logs;
            if (filter) {
                // create a copy and set block range
                const logFilter = { ...filter, fromBlock: this.startBlock, toBlock: latest };
                logs = await provider.getLogs(logFilter);
            } else {
                // fallback: attempt to build topics using the interface
                const topic = this.contract.interface.getEventTopic('DelegateChanged');
                if (!topic) return [];
                const logFilter = { address: CONTRACT_CONFIG.address, topics: [topic], fromBlock: this.startBlock, toBlock: latest };
                logs = await provider.getLogs(logFilter);
            }

            const iface = this.contract.interface;
            const delegates = new Set();

            for (const log of logs) {
                try {
                    const parsed = iface.parseLog(log);
                    if (parsed?.name === 'DelegateChanged') {
                        // parsed.args may contain [delegator, fromDelegate, toDelegate]
                        const delegator = parsed.args?.[0];
                        const toDelegate = parsed.args?.[2];
                        if (toDelegate && toDelegate.toLowerCase() === address.toLowerCase()) {
                            delegates.add(delegator);
                        }
                    }
                } catch (e) { /* ignore parse errors */ }
            }

            return Array.from(delegates);
        } catch (error) {
            console.error('Failed to get delegates:', error?.message || error);
            return [];
        }
    }

    async hasVoted(proposalId, address) {
        try {
            if (!this.contract) return false;
            if (typeof this.contract.hasVoted !== 'function') return false;
            return await this.contract.hasVoted(proposalId, address);
        } catch (error) {
            console.error('Failed to check vote status:', error?.message || error);
            return false;
        }
    }

    async getVotingHistory(address) {
        try {
            const cacheKey = `votingHistory:${address}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) return cached;

            // If a subgraph or helper exists, prefer it (not implemented here)
            const history = []; // placeholder
            this.setCache(cacheKey, history, 120000);
            return history;
        } catch (error) {
            console.error('Failed to get voting history:', error?.message || error);
            return [];
        }
    }

    async estimateGas(method, params = [], value = null) {
        try {
            const options = value ? { value } : {};
            if (!this.contract?.estimateGas) throw new Error('estimateGas not available on contract');
            const estimator = this.contract.estimateGas[method];
            if (typeof estimator === 'function') return await estimator(...params, options);
            throw new Error(`No gas estimator for method ${method}`);
        } catch (error) {
            console.error(`Failed to estimate gas for ${method}:`, error?.message || error);
            // Return default gas limit as fallback (ensure BigNumber)
            const fallback = GAS_LIMITS[method?.toUpperCase()] || 300000;
            return ethers.BigNumber.from(fallback);
        }
    }

    extractProposalIdFromReceipt(receipt) {
        try {
            const evt = receipt.events?.find(e => e.event === 'ProposalCreated');
            const id = evt?.args?.proposalId;
            if (id == null) return null;
            // convert to number if possible
            if (typeof id.toNumber === 'function') return id.toNumber();
            return Number(id.toString?.() || id);
        } catch (error) {
            console.error('Failed to extract proposal ID:', error?.message || error);
            return null;
        }
    }

    async calculateParticipation(proposal) {
        try {
            const forVotes = ethers.BigNumber.from(proposal.forVotes || 0);
            const againstVotes = ethers.BigNumber.from(proposal.againstVotes || 0);
            const totalVotes = forVotes.add(againstVotes);
            if (totalVotes.isZero()) return 0;

            // Prefer contract-provided totalVotingPower if available
            if (typeof this.contract.totalVotingPower === 'function') {
                const totalVotingPowerBN = await this.contract.totalVotingPower();
                if (totalVotingPowerBN && !ethers.BigNumber.from(totalVotingPowerBN).isZero()) {
                    const percent = totalVotes.mul(10000).div(totalVotingPowerBN).toNumber() / 100; // two decimals
                    return percent;
                }
            }

            // Fallback: participation vs number of members if available
            if (typeof this.contract.memberCount === 'function') {
                const memberCountBN = await this.contract.memberCount();
                if (memberCountBN && memberCountBN.gt(0)) {
                    // interpret each member as 1 vote for a rough metric
                    const percent = totalVotes.mul(100).div(memberCountBN).toNumber();
                    return percent;
                }
            }

            return 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * getProposalStatus supports either:
     *  - a normalized proposal object with fields `executed` and `endTime`
     *  - a raw contract struct (will check properties)
     */
    getProposalStatus(proposalLike) {
        try {
            const executed = Boolean(proposalLike.executed || (proposalLike.executed === 1));
            const endTime = Number(proposalLike.endTime || 0);
            const now = Math.floor(Date.now() / 1000);
            if (executed) return 'executed';
            if (endTime > now) return 'active';
            return 'pending';
        } catch (e) {
            return 'unknown';
        }
    }

    getTimeRemaining(proposal) {
        const now = Math.floor(Date.now() / 1000);
        const timeLeft = Math.max(0, (proposal.endTime || 0) - now);
        const days = Math.floor(timeLeft / 86400);
        const hours = Math.floor((timeLeft % 86400) / 3600);
        const minutes = Math.floor((timeLeft % 3600) / 60);
        const seconds = timeLeft % 60;
        return { total: timeLeft, days, hours, minutes, seconds, formatted: `${days}d ${hours}h ${minutes}m ${seconds}s`, isExpired: timeLeft === 0 };
    }

    checkRateLimit(action, limit, window) {
        const now = Date.now();
        const key = `${action}_${this.web3Manager.userAddress}`;
        if (!this.rateLimits.has(key)) this.rateLimits.set(key, []);
        const attempts = this.rateLimits.get(key);
        const validAttempts = attempts.filter(ts => now - ts < window);
        if (validAttempts.length >= limit) return false;
        validAttempts.push(now);
        this.rateLimits.set(key, validAttempts);
        return true;
    }

    getRateLimitStatus(action) {
        const key = `${action}_${this.web3Manager.userAddress}`;
        const attempts = this.rateLimits.get(key) || [];
        const limits = { createProposal: { limit: 5, window: 3600000 }, castVote: { limit: 10, window: 60000 }, setDelegate: { limit: 3, window: 3600000 } };
        const config = limits[action] || { limit: 10, window: 60000 };
        const now = Date.now();
        const validAttempts = attempts.filter(t => now - t < config.window);
        return { remaining: Math.max(0, config.limit - validAttempts.length), limit: config.limit, resetTime: validAttempts.length > 0 ? validAttempts[0] + config.window : now };
    }

    setCache(key, value, ttl = this.CACHE_TTL) { this.cache.set(key, value); this.cacheExpiry.set(key, Date.now() + ttl); }
    getFromCache(key) { if (!this.cache.has(key)) return null; const expiry = this.cacheExpiry.get(key); if (Date.now() > expiry) { this.cache.delete(key); this.cacheExpiry.delete(key); return null; } return this.cache.get(key); }
    invalidateCache(pattern, id = null) { if (id !== null) { const key = `${pattern}:${id}`; this.cache.delete(key); this.cacheExpiry.delete(key); } else { for (const key of Array.from(this.cache.keys())) if (key.startsWith(pattern)) { this.cache.delete(key); this.cacheExpiry.delete(key); } } }
    clearCache() { this.cache.clear(); this.cacheExpiry.clear(); }

    updateGasMetrics(gasUsed) {
        try {
            const currentAvg = this.metrics.averageGasUsed || 0;
            const count = this.metrics.transactionCount || 1;
            this.metrics.averageGasUsed = Math.floor((currentAvg * (count - 1) + Number(gasUsed.toString())) / count);
        } catch (error) { /* ignore */ }
    }

    getMetrics() { return { ...this.metrics, cacheSize: this.cache.size, rateLimitEntries: this.rateLimits.size, successRate: this.metrics.transactionCount > 0 ? ((this.metrics.transactionCount - this.metrics.failedTransactions) / this.metrics.transactionCount * 100).toFixed(2) + '%' : '0%' }; }
    resetMetrics() { this.metrics = { transactionCount: 0, failedTransactions: 0, averageGasUsed: 0, cacheHits: 0, cacheMisses: 0 }; }

    handleContractError(error, method) {
        console.error(`Contract error in ${method}:`, error);
        const rawMsg = (error?.message || String(error)).toLowerCase();
        let errorCode = ERROR_CODES.CONTRACT_ERROR;
        let message = error?.message || String(error);
        let details = null;

        if (rawMsg.includes('insufficient funds')) { errorCode = ERROR_CODES.INSUFFICIENT_FUNDS; message = 'Insufficient funds for this transaction'; }
        else if (rawMsg.includes('user rejected') || rawMsg.includes('user denied')) { errorCode = ERROR_CODES.USER_REJECTED; message = 'Transaction rejected by user'; }
        else if (rawMsg.includes('already member')) { errorCode = ERROR_CODES.ALREADY_MEMBER; message = 'Already a DAO member'; }
        else if (rawMsg.includes('not member')) { errorCode = ERROR_CODES.NOT_MEMBER; message = 'Must be a DAO member'; }
        else if (rawMsg.includes('gas required exceeds')) { errorCode = ERROR_CODES.GAS_LIMIT_EXCEEDED; message = 'Transaction requires too much gas'; }
        else if (rawMsg.includes('nonce too low')) { errorCode = ERROR_CODES.NONCE_ERROR; message = 'Transaction nonce error. Please try again'; }
        else if (rawMsg.includes('replacement fee too low') || rawMsg.includes('replacement transaction underpriced')) { errorCode = ERROR_CODES.REPLACEMENT_UNDERPRICED; message = 'Replacement transaction underpriced'; }
        else if (rawMsg.includes('network')) { errorCode = ERROR_CODES.NETWORK_ERROR; message = 'Network error. Please check your connection'; }
        else if (error?.code === 'UNPREDICTABLE_GAS_LIMIT') { errorCode = ERROR_CODES.EXECUTION_REVERTED; message = 'Transaction would fail. Please check parameters'; details = error.error?.message || null; }

        // Expose a normalized event for callers
        this.dispatchEvent(new CustomEvent('contract:error', { detail: { error, errorCode, message, method, details } }));

        return { success: false, error: message, errorCode, details, method };
    }

    delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    subscribeToEvent(eventName, callback) { if (!this.contract) throw new Error('Contract not initialized'); this.contract.on(eventName, callback); return () => { this.contract.off(eventName, callback); }; }
    unsubscribeFromAllEvents() { if (this.contract) { try { this.contract.removeAllListeners(); } catch (e) { /* ignore */ } } }

    getContractAddress() { return CONTRACT_CONFIG.address; }
    getContractABI() { return CONTRACT_CONFIG.abi; }
    isReady() { return this.isInitialized && this.web3Manager?.isConnected; }

    async exportData() {
        try {
            const analytics = await this.getAnalytics(false);
            const userAddress = this.web3Manager.userAddress;
            const memberInfo = await this.getMemberInfo(userAddress, false);
            return { timestamp: Date.now(), userAddress, memberInfo, analytics, metrics: this.getMetrics(), version: '1.1' };
        } catch (error) {
            console.error('Failed to export data:', error?.message || error);
            throw error;
        }
    }

    async healthCheck() {
        const health = { isInitialized: this.isInitialized, isConnected: this.web3Manager?.isConnected, contractAddress: CONTRACT_CONFIG.address, cacheSize: this.cache.size, timestamp: Date.now() };
        if (this.isInitialized) {
            try {
                if (typeof this.contract.memberCount === 'function') {
                    const memberCount = await this.contract.memberCount();
                    health.contractAccessible = true;
                    health.memberCount = Number(memberCount.toString());
                } else {
                    health.contractAccessible = true;
                }
            } catch (error) {
                health.contractAccessible = false;
                health.error = error?.message || error;
            }
        }
        return health;
    }

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

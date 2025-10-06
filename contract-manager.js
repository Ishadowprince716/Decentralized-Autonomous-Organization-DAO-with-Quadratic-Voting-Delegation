// Smart Contract Manager
// js/services/contract-manager.js

import { CONTRACT_CONFIG, ERROR_CODES, GAS_LIMITS, QUADRATIC_VOTING } from '../utils/constants.js';
import { InputValidator } from '../utils/validators.js';

/**
 * Manages smart contract interactions and blockchain operations
 */
export class ContractManager extends EventTarget {
    constructor(web3Manager) {
        super();
        
        this.web3Manager = web3Manager;
        this.contract = null;
        this.isInitialized = false;
        
        // Rate limiting
        this.rateLimits = new Map();
    }

    /**
     * Initialize contract instance
     */
    async initialize() {
        try {
            if (!this.web3Manager.isConnected) {
                throw new Error('Web3 not connected');
            }

            this.contract = new ethers.Contract(
                CONTRACT_CONFIG.address,
                CONTRACT_CONFIG.abi,
                this.web3Manager.signer
            );

            this.isInitialized = true;
            
            this.dispatchEvent(new CustomEvent('contract:initialized'));
        } catch (error) {
            console.error('Failed to initialize contract:', error);
            throw error;
        }
    }

    /**
     * Join DAO with membership fee
     * @param {string} membershipFee - Fee amount in ETH
     * @returns {Promise<Object>} Transaction result
     */
    async joinDAO(membershipFee) {
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

            // Prepare transaction
            const value = ethers.utils.parseEther(membershipFee);
            const gasLimit = GAS_LIMITS.JOIN_DAO;

            const tx = await this.contract.joinDAO({
                value,
                gasLimit
            });

            // Wait for confirmation
            const receipt = await this.web3Manager.waitForTransaction(tx.hash);

            this.dispatchEvent(new CustomEvent('member:joined', {
                detail: { 
                    address: this.web3Manager.userAddress,
                    contribution: membershipFee,
                    txHash: tx.hash 
                }
            }));

            return {
                success: true,
                txHash: tx.hash,
                receipt
            };

        } catch (error) {
            return this.handleContractError(error, 'joinDAO');
        }
    }

    /**
     * Create a new proposal
     * @param {string} title - Proposal title
     * @param {string} description - Proposal description
     * @param {string} category - Proposal category
     * @returns {Promise<Object>} Transaction result
     */
    async createProposal(title, description, category) {
        try {
            if (!this.isInitialized) {
                throw new Error('Contract not initialized');
            }

            // Rate limiting check
            if (!this.checkRateLimit('createProposal', 5, 3600000)) { // 5 per hour
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
            const gasLimit = GAS_LIMITS.CREATE_PROPOSAL;

            const tx = await this.contract.createProposal(
                validation.sanitized.title,
                fullDescription,
                { gasLimit }
            );

            const receipt = await this.web3Manager.waitForTransaction(tx.hash);

            this.dispatchEvent(new CustomEvent('proposal:created', {
                detail: {
                    title: validation.sanitized.title,
                    description: fullDescription,
                    proposer: this.web3Manager.userAddress,
                    txHash: tx.hash
                }
            }));

            return {
                success: true,
                txHash: tx.hash,
                receipt
            };

        } catch (error) {
            return this.handleContractError(error, 'createProposal');
        }
    }

    /**
     * Cast a quadratic vote
     * @param {number} proposalId - Proposal ID
     * @param {number} credits - Credits to spend
     * @param {boolean} support - Vote support (true = for, false = against)
     * @param {string} delegateAddress - Optional delegate address
     * @returns {Promise<Object>} Transaction result
     */
    async castVote(proposalId, credits, support, delegateAddress = null) {
        try {
            if (!this.isInitialized) {
                throw new Error('Contract not initialized');
            }

            // Rate limiting check
            if (!this.checkRateLimit('castVote', 10, 60000)) { // 10 per minute
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

            // Handle delegation if specified
            if (delegateAddress && InputValidator.validateEthereumAddress(delegateAddress)) {
                await this.setDelegate(delegateAddress);
            }

            // Prepare transaction
            const gasLimit = GAS_LIMITS.CAST_VOTE;

            const tx = await this.contract.castQuadraticVote(
                proposalId,
                credits,
                support,
                { gasLimit }
            );

            const receipt = await this.web3Manager.waitForTransaction(tx.hash);

            const votingPower = QUADRATIC_VOTING.calculatePower(credits);

            this.dispatchEvent(new CustomEvent('vote:cast', {
                detail: {
                    proposalId,
                    credits,
                    support,
                    votingPower,
                    voter: this.web3Manager.userAddress,
                    txHash: tx.hash
                }
            }));

            return {
                success: true,
                txHash: tx.hash,
                receipt,
                votingPower
            };

        } catch (error) {
            return this.handleContractError(error, 'castVote');
        }
    }

    /**
     * Set voting delegate
     * @param {string} delegateAddress - Delegate address (or zero address to revoke)
     * @returns {Promise<Object>} Transaction result
     */
    async setDelegate(delegateAddress) {
        try {
            if (!this.isInitialized) {
                throw new Error('Contract not initialized');
            }

            // Rate limiting check
            if (!this.checkRateLimit('setDelegate', 3, 3600000)) { // 3 per hour
                throw new Error('Rate limit exceeded. Please try again later.');
            }

            // Validate address if not revoking delegation
            if (delegateAddress && delegateAddress !== ethers.constants.AddressZero) {
                if (!InputValidator.validateEthereumAddress(delegateAddress)) {
                    throw new Error('Invalid delegate address');
                }
            }

            // Check membership
            const memberInfo = await this.getMemberInfo(this.web3Manager.userAddress);
            if (!memberInfo.isMember) {
                throw new Error('Must be a DAO member to delegate');
            }

            // Use zero address for revocation
            const address = delegateAddress || ethers.constants.AddressZero;
            const gasLimit = GAS_LIMITS.DELEGATE;

            const tx = await this.contract.delegate(address, { gasLimit });

            const receipt = await this.web3Manager.waitForTransaction(tx.hash);

            const isRevocation = address === ethers.constants.AddressZero;

            this.dispatchEvent(new CustomEvent('delegation:set', {
                detail: {
                    delegator: this.web3Manager.userAddress,
                    delegate: address,
                    isRevocation,
                    txHash: tx.hash
                }
            }));

            return {
                success: true,
                txHash: tx.hash,
                receipt,
                isRevocation
            };

        } catch (error) {
            return this.handleContractError(error, 'setDelegate');
        }
    }

    /**
     * Get member information
     * @param {string} address - Member address
     * @returns {Promise<Object>} Member info
     */
    async getMemberInfo(address) {
        try {
            if (!this.isInitialized) {
                throw new Error('Contract not initialized');
            }

            const memberData = await this.contract.members(address);
            
            return {
                isMember: memberData.isMember,
                contribution: memberData.contribution,
                votingPower: memberData.votingPower,
                delegatedTo: memberData.delegatedTo,
                address: address
            };
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
     * Get proposal information
     * @param {number} proposalId - Proposal ID
     * @returns {Promise<Object>} Proposal info
     */
    async getProposal(proposalId) {
        try {
            if (!this.isInitialized) {
                throw new Error('Contract not initialized');
            }

            const proposalData = await this.contract.proposals(proposalId);
            
            return {
                id: proposalId,
                title: proposalData.title,
                description: proposalData.description,
                proposer: proposalData.proposer,
                forVotes: proposalData.forVotes,
                againstVotes: proposalData.againstVotes,
                executed: proposalData.executed,
                endTime: proposalData.endTime,
                status: this.getProposalStatus(proposalData)
            };
        } catch (error) {
            console.error('Failed to get proposal:', error);
            return null;
        }
    }

    /**
     * Get all proposals
     * @returns {Promise<Array>} Array of proposals
     */
    async getProposals() {
        try {
            if (!this.isInitialized) {
                throw new Error('Contract not initialized');
            }

            const proposalCount = await this.contract.proposalCount();
            const proposals = [];

            for (let i = 0; i < proposalCount; i++) {
                const proposal = await this.getProposal(i);
                if (proposal) {
                    proposals.push(proposal);
                }
            }

            return proposals;
        } catch (error) {
            console.error('Failed to get proposals:', error);
            return [];
        }
    }

    /**
     * Get DAO analytics
     * @returns {Promise<Object>} Analytics data
     */
    async getAnalytics() {
        try {
            if (!this.isInitialized) {
                throw new Error('Contract not initialized');
            }

            const [memberCount, proposalCount] = await Promise.all([
                this.contract.memberCount(),
                this.contract.proposalCount()
            ]);

            // Calculate additional metrics
            const proposals = await this.getProposals();
            const activeProposals = proposals.filter(p => p.status === 'active').length;
            const totalVotes = proposals.reduce((sum, p) => 
                sum + parseInt(p.forVotes) + parseInt(p.againstVotes), 0
            );

            return {
                totalMembers: memberCount.toNumber(),
                totalProposals: proposalCount.toNumber(),
                activeProposals,
                totalVotes,
                proposals
            };
        } catch (error) {
            console.error('Failed to get analytics:', error);
            return {
                totalMembers: 0,
                totalProposals: 0,
                activeProposals: 0,
                totalVotes: 0,
                proposals: []
            };
        }
    }

    /**
     * Get delegation information for an address
     * @param {string} address - Address to check
     * @returns {Promise<Object>} Delegation info
     */
    async getDelegationInfo(address) {
        try {
            const memberInfo = await this.getMemberInfo(address);
            
            return {
                currentDelegate: memberInfo.delegatedTo,
                isDelegating: memberInfo.delegatedTo !== ethers.constants.AddressZero,
                votingPower: memberInfo.votingPower
            };
        } catch (error) {
            console.error('Failed to get delegation info:', error);
            return {
                currentDelegate: ethers.constants.AddressZero,
                isDelegating: false,
                votingPower: ethers.BigNumber.from(0)
            };
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
     * Handle contract errors
     * @param {Error} error - Contract error
     * @param {string} method - Contract method name
     * @returns {Object} Error result
     */
    handleContractError(error, method) {
        console.error(`Contract error in ${method}:`, error);

        let errorCode = ERROR_CODES.CONTRACT_ERROR;
        let message = error.message;

        // Map specific contract errors
        if (error.message.includes('insufficient funds')) {
            errorCode = ERROR_CODES.INSUFFICIENT_FUNDS;
            message = 'Insufficient funds for this transaction';
        } else if (error.message.includes('user rejected')) {
            errorCode = ERROR_CODES.USER_REJECTED;
            message = 'Transaction rejected by user';
        } else if (error.message.includes('already member')) {
            errorCode = ERROR_CODES.ALREADY_MEMBER;
            message = 'Already a DAO member';
        } else if (error.message.includes('not member')) {
            errorCode = ERROR_CODES.NOT_MEMBER;
            message = 'Must be a DAO member';
        }

        this.dispatchEvent(new CustomEvent('contract:error', {
            detail: { error, errorCode, message, method }
        }));

        return {
            success: false,
            error: message,
            errorCode
        };
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.contract = null;
        this.isInitialized = false;
        this.rateLimits.clear();
    }
}

export default ContractManager;
/**
 * Web3 Service
 * Handles all blockchain interactions with the QuadraticDAO contract
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

class Web3Service {
    constructor() {
        this.provider = null;
        this.contract = null;
        this.signer = null;
        this.eventListeners = [];
    }

    /**
     * Initialize blockchain connection
     */
    async initialize() {
        try {
            // Setup provider
            const rpcUrl = process.env.RPC_URL || 'https://rpc.test2.btcs.network';
            this.provider = new ethers.JsonRpcProvider(rpcUrl);

            // Load contract ABI
            const contractPath = path.join(__dirname, '../../artifacts/contracts/Decentralized-Autonomous-Organization-DAO-with-Quadratic-Voting-Delegation.sol/QuadraticDAO.json');
            const contractJson = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
            const contractABI = contractJson.abi;

            // Initialize contract
            const contractAddress = process.env.CONTRACT_ADDRESS;
            if (!contractAddress) {
                throw new Error('CONTRACT_ADDRESS not set in environment variables');
            }

            this.contract = new ethers.Contract(
                contractAddress,
                contractABI,
                this.provider
            );

            // Setup signer if private key is available
            if (process.env.PRIVATE_KEY) {
                this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
                this.contract = this.contract.connect(this.signer);
            }

            // Setup event listeners
            this.setupEventListeners();

            console.log('✅ Web3Service initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Web3Service initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup blockchain event listeners
     */
    setupEventListeners() {
        // ProposalCreated event
        this.contract.on('ProposalCreated', (id, proposer, startBlock, endBlock, event) => {
            console.log(`📝 New Proposal Created: ID ${id}`);
            this.emitToWebSocket('proposal:created', {
                id: id.toString(),
                proposer,
                startBlock: startBlock.toString(),
                endBlock: endBlock.toString()
            });
        });

        // Voted event
        this.contract.on('Voted', (proposalId, delegate, support, weight, event) => {
            console.log(`🗳️ Vote Cast: Proposal ${proposalId}`);
            this.emitToWebSocket('vote:cast', {
                proposalId: proposalId.toString(),
                delegate,
                support,
                weight: weight.toString()
            });
        });

        // ProposalFinalized event
        this.contract.on('ProposalFinalized', (proposalId, passed, event) => {
            console.log(`✅ Proposal Finalized: ID ${proposalId}, Passed: ${passed}`);
            this.emitToWebSocket('proposal:finalized', {
                proposalId: proposalId.toString(),
                passed
            });
        });

        // Staked event
        this.contract.on('Staked', (user, amount, event) => {
            console.log(`💰 Stake: ${user} staked ${ethers.formatEther(amount)} tokens`);
            this.emitToWebSocket('stake:added', {
                user,
                amount: ethers.formatEther(amount)
            });
        });

        // MemberAdded event
        this.contract.on('MemberAdded', (member, event) => {
            console.log(`👤 New Member: ${member}`);
            this.emitToWebSocket('member:added', { member });
        });
    }

    /**
     * Get DAO statistics
     */
    async getDAOStats() {
        try {
            const [proposalCount, memberCount, totalStaked, quorum, threshold] = await Promise.all([
                this.contract.proposalCount(),
                this.contract.getMemberCount(),
                this.contract.getTotalStaked(),
                this.contract.quorumPercentage(),
                this.contract.proposalStakeThreshold()
            ]);

            return {
                proposalCount: proposalCount.toString(),
                memberCount: memberCount.toString(),
                totalStaked: ethers.formatEther(totalStaked),
                quorumPercentage: quorum.toString(),
                proposalStakeThreshold: ethers.formatEether(threshold)
            };
        } catch (error) {
            console.error('Error fetching DAO stats:', error);
            throw error;
        }
    }

    /**
     * Get proposal details
     */
    async getProposal(proposalId) {
        try {
            const proposal = await this.contract.getProposal(proposalId);
            const status = await this.contract.getProposalStatus(proposalId);

            return {
                id: proposal.id.toString(),
                proposer: proposal.proposer,
                description: proposal.description,
                startBlock: proposal.startBlock.toString(),
                endBlock: proposal.endBlock.toString(),
                forVotes: proposal.forVotes.toString(),
                againstVotes: proposal.againstVotes.toString(),
                finalized: proposal.finalized,
                executed: proposal.executed,
                isActive: status.isActive,
                isPassed: status.isPassed,
                isExecuted: status.isExecuted,
                totalVotes: status.totalVotes.toString()
            };
        } catch (error) {
            console.error(`Error fetching proposal ${proposalId}:`, error);
            throw error;
        }
    }

    /**
     * Get all proposals
     */
    async getAllProposals() {
        try {
            const proposalIds = await this.contract.getAllProposals();
            const proposals = await Promise.all(
                proposalIds.map(id => this.getProposal(id))
            );
            return proposals;
        } catch (error) {
            console.error('Error fetching all proposals:', error);
            throw error;
        }
    }

    /**
     * Get member information
     */
    async getMemberInfo(address) {
        try {
            const [stake, delegate, delegateWeight, isMember] = await Promise.all([
                this.contract.stakeOf(address),
                this.contract.delegateOf(address),
                this.contract.getDelegateWeight(address),
                this.contract.isMember(address)
            ]);

            return {
                address,
                stake: ethers.formatEther(stake),
                delegate,
                votingPower: delegateWeight.toString(),
                isMember
            };
        } catch (error) {
            console.error(`Error fetching member info for ${address}:`, error);
            throw error;
        }
    }

    /**
     * Get voting power (quadratic)
     */
    async getVotingPower(address) {
        try {
            const weight = await this.contract.getDelegateWeight(address);
            return weight.toString();
        } catch (error) {
            console.error(`Error fetching voting power for ${address}:`, error);
            throw error;
        }
    }

    /**
     * Create proposal (requires signer)
     */
    async createProposal(description, votingBlocks, proposalData = '0x') {
        try {
            if (!this.signer) {
                throw new Error('Signer not configured');
            }

            const tx = await this.contract.createProposal(
                description,
                votingBlocks,
                proposalData
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return this.contract.interface.parseLog(log).name === 'ProposalCreated';
                } catch {
                    return false;
                }
            });

            const parsedEvent = this.contract.interface.parseLog(event);
            return {
                proposalId: parsedEvent.args.id.toString(),
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            console.error('Error creating proposal:', error);
            throw error;
        }
    }

    /**
     * Cast vote
     */
    async castVote(proposalId, support) {
        try {
            if (!this.signer) {
                throw new Error('Signer not configured');
            }

            const tx = await this.contract.vote(proposalId, support);
            const receipt = await tx.wait();

            return {
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            console.error('Error casting vote:', error);
            throw error;
        }
    }

    /**
     * Finalize proposal
     */
    async finalizeProposal(proposalId) {
        try {
            if (!this.signer) {
                throw new Error('Signer not configured');
            }

            const tx = await this.contract.finalizeProposal(proposalId);
            const receipt = await tx.wait();

            return {
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            console.error('Error finalizing proposal:', error);
            throw error;
        }
    }

    /**
     * Get current block number
     */
    async getCurrentBlock() {
        try {
            const blockNumber = await this.provider.getBlockNumber();
            return blockNumber;
        } catch (error) {
            console.error('Error fetching block number:', error);
            throw error;
        }
    }

    /**
     * Emit event to WebSocket
     */
    emitToWebSocket(event, data) {
        if (this.io) {
            this.io.emit(event, data);
        }
    }

    /**
     * Set WebSocket instance
     */
    setWebSocket(io) {
        this.io = io;
    }

    /**
     * Cleanup and remove listeners
     */
    cleanup() {
        if (this.contract) {
            this.contract.removeAllListeners();
        }
        console.log('✅ Web3Service cleaned up');
    }
}

module.exports = Web3Service;
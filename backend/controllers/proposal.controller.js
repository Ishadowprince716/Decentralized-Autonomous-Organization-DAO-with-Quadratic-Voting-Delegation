/**
 * Proposal Controller
 * Handles proposal-related API logic
 */

const asyncHandler = require('../middleware/asyncHandler');

class ProposalController {
    /**
     * Get all proposals
     */
    static getAllProposals = asyncHandler(async (req, res) => {
        const web3Service = req.app.locals.web3Service;
        const cacheService = req.app.locals.cacheService;

        // Check cache first
        const cacheKey = 'all_proposals';
        const cached = cacheService.get(cacheKey);
        
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                cached: true
            });
        }

        const proposals = await web3Service.getAllProposals();
        
        // Cache for 30 seconds
        cacheService.set(cacheKey, proposals, 30);

        res.json({
            success: true,
            count: proposals.length,
            data: proposals
        });
    });

    /**
     * Get single proposal
     */
    static getProposal = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const web3Service = req.app.locals.web3Service;
        const cacheService = req.app.locals.cacheService;

        const cacheKey = `proposal_${id}`;
        const cached = cacheService.get(cacheKey);
        
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                cached: true
            });
        }

        const proposal = await web3Service.getProposal(id);
        
        cacheService.set(cacheKey, proposal, 30);

        res.json({
            success: true,
            data: proposal
        });
    });

    /**
     * Create new proposal
     */
    static createProposal = asyncHandler(async (req, res) => {
        const { description, votingBlocks, proposalData } = req.body;
        const web3Service = req.app.locals.web3Service;

        const result = await web3Service.createProposal(
            description,
            votingBlocks,
            proposalData || '0x'
        );

        // Clear cache
        req.app.locals.cacheService.clear('all_proposals');

        res.status(201).json({
            success: true,
            message: 'Proposal created successfully',
            data: result
        });
    });

    /**
     * Finalize proposal
     */
    static finalizeProposal = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const web3Service = req.app.locals.web3Service;

        const result = await web3Service.finalizeProposal(id);

        // Clear cache
        req.app.locals.cacheService.delete(`proposal_${id}`);
        req.app.locals.cacheService.clear('all_proposals');

        res.json({
            success: true,
            message: 'Proposal finalized successfully',
            data: result
        });
    });

    /**
     * Execute proposal
     */
    static executeProposal = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const web3Service = req.app.locals.web3Service;

        // This would need to be implemented in web3Service
        // For now, return not implemented
        res.status(501).json({
            success: false,
            message: 'Execute proposal endpoint not yet implemented'
        });
    });

    /**
     * Cancel proposal
     */
    static cancelProposal = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const web3Service = req.app.locals.web3Service;

        // This would need to be implemented in web3Service
        res.status(501).json({
            success: false,
            message: 'Cancel proposal endpoint not yet implemented'
        });
    });

    /**
     * Get proposal status
     */
    static getProposalStatus = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const web3Service = req.app.locals.web3Service;

        const proposal = await web3Service.getProposal(id);

        res.json({
            success: true,
            data: {
                proposalId: id,
                isActive: proposal.isActive,
                isPassed: proposal.isPassed,
                isExecuted: proposal.isExecuted,
                finalized: proposal.finalized
            }
        });
    });

    /**
     * Get proposal votes
     */
    static getProposalVotes = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const web3Service = req.app.locals.web3Service;

        const proposal = await web3Service.getProposal(id);

        res.json({
            success: true,
            data: {
                proposalId: id,
                forVotes: proposal.forVotes,
                againstVotes: proposal.againstVotes,
                totalVotes: proposal.totalVotes
            }
        });
    });
}

module.exports = ProposalController;
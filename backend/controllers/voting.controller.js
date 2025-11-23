/**
 * Voting Controller
 * Handles voting-related API logic
 */

const asyncHandler = require('../middleware/asyncHandler');

class VotingController {
    /**
     * Cast vote
     */
    static castVote = asyncHandler(async (req, res) => {
        const { proposalId, support, signerAddress } = req.body;
        const web3Service = req.app.locals.web3Service;

        const result = await web3Service.castVote(proposalId, support);

        // Clear relevant caches
        req.app.locals.cacheService.delete(`proposal_${proposalId}`);
        req.app.locals.cacheService.clear('all_proposals');

        res.json({
            success: true,
            message: 'Vote cast successfully',
            data: result
        });
    });

    /**
     * Get voting power
     */
    static getVotingPower = asyncHandler(async (req, res) => {
        const { address } = req.params;
        const web3Service = req.app.locals.web3Service;
        const cacheService = req.app.locals.cacheService;

        const cacheKey = `voting_power_${address}`;
        const cached = cacheService.get(cacheKey);
        
        if (cached) {
            return res.json({
                success: true,
                data: { address, votingPower: cached },
                cached: true
            });
        }

        const votingPower = await web3Service.getVotingPower(address);
        
        cacheService.set(cacheKey, votingPower, 60);

        res.json({
            success: true,
            data: {
                address,
                votingPower
            }
        });
    });

    /**
     * Check if address has voted
     */
    static hasVoted = asyncHandler(async (req, res) => {
        const { proposalId, address } = req.params;
        const web3Service = req.app.locals.web3Service;

        // This would require adding a method to web3Service
        // For now return placeholder
        res.json({
            success: true,
            data: {
                proposalId,
                address,
                hasVoted: false // placeholder
            }
        });
    });

    /**
     * Get vote details
     */
    static getVoteDetails = asyncHandler(async (req, res) => {
        const { proposalId, address } = req.params;
        const web3Service = req.app.locals.web3Service;

        // This would require adding a method to web3Service
        res.json({
            success: true,
            data: {
                proposalId,
                address,
                hasVoted: false,
                support: null,
                weight: '0'
            }
        });
    });
}

module.exports = VotingController;
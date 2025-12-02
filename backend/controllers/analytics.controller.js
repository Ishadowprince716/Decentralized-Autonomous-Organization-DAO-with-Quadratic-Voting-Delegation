/**
 * Analytics Controller
 * Handles analytics and statistics
 */

const asyncHandler = require('../middleware/asyncHandler');

class AnalyticsController {
    /**
     * Get voting statistics
     */
    static getVotingStats = asyncHandler(async (req, res) => {
        const web3Service = req.app.locals.web3Service;
        const cacheService = req.app.locals.cacheService;

        const cacheKey = 'voting_stats';
        const cached = cacheService.get(cacheKey);
        
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                cached: true
            });
        }

        const proposals = await web3Service.getAllProposals();
        
        const stats = {
            totalProposals: proposals.length,
            activeProposals: proposals.filter(p => p.isActive).length,
            passedProposals: proposals.filter(p => p.isPassed).length,
            executedProposals: proposals.filter(p => p.isExecuted).length,
            totalVotes: proposals.reduce((sum, p) => sum + parseInt(p.totalVotes), 0)
        };
        
        cacheService.set(cacheKey, stats, 120);

        res.json({
            success: true,
            data: stats
        });
    });

    /**
     * Get proposal trends
     */
    static getProposalTrends = asyncHandler(async (req, res) => {
        const web3Service = req.app.locals.web3Service;

        const proposals = await web3Service.getAllProposals();
        
        // Group proposals by creation time (simplified)
        const trends = {
            total: proposals.length,
            recentTrend: 'stable' // This would need more complex calculation
        };

        res.json({
            success: true,
            data: trends
        });
    });

    /**
     * Get member growth
     */
    static getMemberGrowth = asyncHandler(async (req, res) => {
        const web3Service = req.app.locals.web3Service;

        const stats = await web3Service.getDAOStats();
        
        res.json({
            success: true,
            data: {
                totalMembers: stats.memberCount,
                growth: 'N/A' // Would need historical data
            }
        });
    });

    /**
     * Get participation rate
     */
    static getParticipationRate = asyncHandler(async (req, res) => {
        const web3Service = req.app.locals.web3Service;

        const [proposals, stats] = await Promise.all([
            web3Service.getAllProposals(),
            web3Service.getDAOStats()
        ]);

        const totalMembers = parseInt(stats.memberCount);
        const avgParticipation = totalMembers > 0 
            ? proposals.reduce((sum, p) => {
                const votes = parseInt(p.forVotes) + parseInt(p.againstVotes);
                return sum + votes;
              }, 0) / (proposals.length * totalMembers)
            : 0;

        res.json({
            success: true,
            data: {
                participationRate: (avgParticipation * 100).toFixed(2) + '%',
                totalMembers,
                totalProposals: proposals.length
            }
        });
    });

    /**
     * Get top voters
     */
    static getTopVoters = asyncHandler(async (req, res) => {
        // This would require tracking voter addresses across proposals
        // Not easily available from current contract design
        res.json({
            success: true,
            data: [],
            message: 'Top voters tracking requires additional indexing'
        });
    });

    /**
     * Get delegation statistics
     */
    static getDelegationStats = asyncHandler(async (req, res) => {
        const web3Service = req.app.locals.web3Service;

        // This would require iterating through all members
        // For now return placeholder
        res.json({
            success: true,
            data: {
                message: 'Delegation stats require member address indexing'
            }
        });
    });
}

module.exports = AnalyticsController;
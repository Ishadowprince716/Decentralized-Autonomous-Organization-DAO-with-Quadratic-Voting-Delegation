/**
 * DAO Controller
 * Handles general DAO operations
 */

const asyncHandler = require('../middleware/asyncHandler');

class DAOController {
    /**
     * Get DAO statistics
     */
    static getStats = asyncHandler(async (req, res) => {
        const web3Service = req.app.locals.web3Service;
        const cacheService = req.app.locals.cacheService;

        const cacheKey = 'dao_stats';
        const cached = cacheService.get(cacheKey);
        
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                cached: true
            });
        }

        const stats = await web3Service.getDAOStats();
        
        cacheService.set(cacheKey, stats, 60);

        res.json({
            success: true,
            data: stats
        });
    });

    /**
     * Get DAO configuration
     */
    static getConfig = asyncHandler(async (req, res) => {
        const web3Service = req.app.locals.web3Service;

        const stats = await web3Service.getDAOStats();

        res.json({
            success: true,
            data: {
                contractAddress: process.env.CONTRACT_ADDRESS,
                network: process.env.NETWORK || 'unknown',
                quorumPercentage: stats.quorumPercentage,
                proposalStakeThreshold: stats.proposalStakeThreshold
            }
        });
    });

    /**
     * Update proposal threshold (admin only)
     */
    static updateThreshold = asyncHandler(async (req, res) => {
        const { threshold } = req.body;
        const web3Service = req.app.locals.web3Service;

        // This would require implementing in web3Service
        res.status(501).json({
            success: false,
            message: 'Update threshold endpoint not yet implemented'
        });
    });

    /**
     * Update quorum percentage (admin only)
     */
    static updateQuorum = asyncHandler(async (req, res) => {
        const { quorum } = req.body;
        const web3Service = req.app.locals.web3Service;

        // This would require implementing in web3Service
        res.status(501).json({
            success: false,
            message: 'Update quorum endpoint not yet implemented'
        });
    });

    /**
     * Get current block number
     */
    static getCurrentBlock = asyncHandler(async (req, res) => {
        const web3Service = req.app.locals.web3Service;

        const blockNumber = await web3Service.getCurrentBlock();

        res.json({
            success: true,
            data: {
                blockNumber
            }
        });
    });
}

module.exports = DAOController;
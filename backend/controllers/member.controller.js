/**
 * Member Controller
 * Handles member-related API logic
 */

const asyncHandler = require('../middleware/asyncHandler');

class MemberController {
    /**
     * Get member info
     */
    static getMemberInfo = asyncHandler(async (req, res) => {
        const { address } = req.params;
        const web3Service = req.app.locals.web3Service;
        const cacheService = req.app.locals.cacheService;

        const cacheKey = `member_${address}`;
        const cached = cacheService.get(cacheKey);
        
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                cached: true
            });
        }

        const memberInfo = await web3Service.getMemberInfo(address);
        
        cacheService.set(cacheKey, memberInfo, 60);

        res.json({
            success: true,
            data: memberInfo
        });
    });

    /**
     * Get all members
     */
    static getAllMembers = asyncHandler(async (req, res) => {
        const web3Service = req.app.locals.web3Service;
        const cacheService = req.app.locals.cacheService;

        const cacheKey = 'all_members';
        const cached = cacheService.get(cacheKey);
        
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                cached: true
            });
        }

        // This would require implementing a method to get all member addresses
        // For now return placeholder
        const members = [];
        
        cacheService.set(cacheKey, members, 120);

        res.json({
            success: true,
            count: members.length,
            data: members
        });
    });

    /**
     * Stake tokens
     */
    static stake = asyncHandler(async (req, res) => {
        const { amount } = req.body;
        const web3Service = req.app.locals.web3Service;

        // This would require implementing stake in web3Service
        res.status(501).json({
            success: false,
            message: 'Stake endpoint not yet implemented - use frontend for staking'
        });
    });

    /**
     * Unstake tokens
     */
    static unstake = asyncHandler(async (req, res) => {
        const { amount } = req.body;
        const web3Service = req.app.locals.web3Service;

        // This would require implementing unstake in web3Service
        res.status(501).json({
            success: false,
            message: 'Unstake endpoint not yet implemented - use frontend for unstaking'
        });
    });

    /**
     * Set delegate
     */
    static setDelegate = asyncHandler(async (req, res) => {
        const { delegateAddress } = req.body;
        const web3Service = req.app.locals.web3Service;

        // This would require implementing setDelegate in web3Service
        res.status(501).json({
            success: false,
            message: 'Set delegate endpoint not yet implemented - use frontend'
        });
    });

    /**
     * Get delegation info
     */
    static getDelegationInfo = asyncHandler(async (req, res) => {
        const { address } = req.params;
        const web3Service = req.app.locals.web3Service;

        const memberInfo = await web3Service.getMemberInfo(address);

        res.json({
            success: true,
            data: {
                address,
                delegate: memberInfo.delegate,
                votingPower: memberInfo.votingPower
            }
        });
    });
}

module.exports = MemberController;
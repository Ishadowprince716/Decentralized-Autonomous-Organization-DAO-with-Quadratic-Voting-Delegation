/**
 * Validation Middleware
 * Request validation helpers
 */

const { ethers } = require('ethers');

/**
 * Validate Ethereum address
 */
const validateAddress = (req, res, next) => {
    const address = req.params.address || req.body.address;
    
    if (!address) {
        return res.status(400).json({
            success: false,
            error: 'Address is required'
        });
    }

    if (!ethers.isAddress(address)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Ethereum address'
        });
    }

    next();
};

/**
 * Validate proposal ID
 */
const validateProposalId = (req, res, next) => {
    const { id } = req.params;
    
    if (!id) {
        return res.status(400).json({
            success: false,
            error: 'Proposal ID is required'
        });
    }

    const proposalId = parseInt(id);
    if (isNaN(proposalId) || proposalId < 1) {
        return res.status(400).json({
            success: false,
            error: 'Invalid proposal ID'
        });
    }

    next();
};

/**
 * Validate proposal creation
 */
const validateProposalCreation = (req, res, next) => {
    const { description, votingBlocks } = req.body;
    
    if (!description || description.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Proposal description is required'
        });
    }

    if (!votingBlocks || votingBlocks < 1) {
        return res.status(400).json({
            success: false,
            error: 'Valid voting blocks count is required'
        });
    }

    next();
};

/**
 * Validate vote
 */
const validateVote = (req, res, next) => {
    const { proposalId, support } = req.body;
    
    if (!proposalId || proposalId < 1) {
        return res.status(400).json({
            success: false,
            error: 'Valid proposal ID is required'
        });
    }

    if (typeof support !== 'boolean') {
        return res.status(400).json({
            success: false,
            error: 'Support must be true or false'
        });
    }

    next();
};

/**
 * Validate stake amount
 */
const validateStake = (req, res, next) => {
    const { amount } = req.body;
    
    if (!amount) {
        return res.status(400).json({
            success: false,
            error: 'Amount is required'
        });
    }

    try {
        const parsedAmount = ethers.parseEther(amount.toString());
        if (parsedAmount <= 0n) {
            throw new Error('Amount must be positive');
        }
    } catch (error) {
        return res.status(400).json({
            success: false,
            error: 'Invalid amount: ' + error.message
        });
    }

    next();
};

/**
 * Validate request body
 */
const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        
        if (error) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: error.details.map(d => d.message)
            });
        }
        
        next();
    };
};

module.exports = {
    validateAddress,
    validateProposalId,
    validateProposalCreation,
    validateVote,
    validateStake,
    validateRequest
};
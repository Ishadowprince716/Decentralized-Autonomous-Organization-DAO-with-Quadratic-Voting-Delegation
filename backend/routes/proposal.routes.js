/**
 * Proposal Routes
 * API endpoints for proposal management
 */

const express = require('express');
const router = express.Router();
const ProposalController = require('../controllers/proposal.controller');
const { validateProposalCreation, validateProposalId } = require('../middleware/validation');

// Get all proposals
router.get('/', ProposalController.getAllProposals);

// Get single proposal
router.get('/:id', validateProposalId, ProposalController.getProposal);

// Create new proposal
router.post('/', validateProposalCreation, ProposalController.createProposal);

// Finalize proposal
router.post('/:id/finalize', validateProposalId, ProposalController.finalizeProposal);

// Execute proposal
router.post('/:id/execute', validateProposalId, ProposalController.executeProposal);

// Cancel proposal
router.post('/:id/cancel', validateProposalId, ProposalController.cancelProposal);

// Get proposal status
router.get('/:id/status', validateProposalId, ProposalController.getProposalStatus);

// Get proposal votes
router.get('/:id/votes', validateProposalId, ProposalController.getProposalVotes);

module.exports = router;
/**
 * Voting Routes
 * API endpoints for voting operations
 */

const express = require('express');
const router = express.Router();
const VotingController = require('../controllers/voting.controller');
const { validateVote, validateProposalId } = require('../middleware/validation');

// Cast vote
router.post('/', validateVote, VotingController.castVote);

// Get voting power
router.get('/power/:address', VotingController.getVotingPower);

// Check if address has voted
router.get('/has-voted/:proposalId/:address', VotingController.hasVoted);

// Get vote details
router.get('/vote-details/:proposalId/:address', VotingController.getVoteDetails);

module.exports = router;
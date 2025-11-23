/**
 * Analytics Routes
 * API endpoints for DAO analytics and statistics
 */

const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analytics.controller');

// Get voting statistics
router.get('/voting-stats', AnalyticsController.getVotingStats);

// Get proposal trends
router.get('/proposal-trends', AnalyticsController.getProposalTrends);

// Get member growth
router.get('/member-growth', AnalyticsController.getMemberGrowth);

// Get voting participation
router.get('/participation', AnalyticsController.getParticipationRate);

// Get top voters
router.get('/top-voters', AnalyticsController.getTopVoters);

// Get delegation statistics
router.get('/delegation-stats', AnalyticsController.getDelegationStats);

module.exports = router;
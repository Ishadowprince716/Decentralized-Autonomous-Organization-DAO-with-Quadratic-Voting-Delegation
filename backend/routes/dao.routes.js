/**
 * DAO Routes
 * API endpoints for general DAO operations
 */

const express = require('express');
const router = express.Router();
const DAOController = require('../controllers/dao.controller');

// Get DAO statistics
router.get('/stats', DAOController.getStats);

// Get DAO configuration
router.get('/config', DAOController.getConfig);

// Update proposal threshold (admin only)
router.post('/config/threshold', DAOController.updateThreshold);

// Update quorum percentage (admin only)
router.post('/config/quorum', DAOController.updateQuorum);

// Get current block number
router.get('/block-number', DAOController.getCurrentBlock);

module.exports = router;
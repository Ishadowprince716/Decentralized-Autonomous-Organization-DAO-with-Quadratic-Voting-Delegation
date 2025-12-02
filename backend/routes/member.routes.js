/**
 * Member Routes
 * API endpoints for member management
 */

const express = require('express');
const router = express.Router();
const MemberController = require('../controllers/member.controller');
const { validateAddress, validateStake } = require('../middleware/validation');

// Get member info
router.get('/:address', validateAddress, MemberController.getMemberInfo);

// Get all members
router.get('/', MemberController.getAllMembers);

// Stake tokens
router.post('/stake', validateStake, MemberController.stake);

// Unstake tokens
router.post('/unstake', validateStake, MemberController.unstake);

// Set delegate
router.post('/delegate', MemberController.setDelegate);

// Get delegation info
router.get('/:address/delegation', validateAddress, MemberController.getDelegationInfo);

module.exports = router;
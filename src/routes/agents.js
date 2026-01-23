const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { createAgent, getAllAgents, updateAgent, deleteAgent, getAgentCommissions } = require('../controllers/agentController');

// All routes require authentication
router.use(auth);

// Get all agents (Admin/Owner)
router.get('/', authorize(2, 3), getAllAgents);

// Create agent (Owner/Admin)
router.post('/', authorize(2, 3), createAgent);

// Update agent (Owner/Admin)
router.put('/:id', authorize(2, 3), updateAgent);

// Delete agent (Owner/Admin)
router.delete('/:id', authorize(2, 3), deleteAgent);

// Get agent commissions (Owner/Admin)
router.get('/:id/commissions', authorize(2, 3), getAgentCommissions);

module.exports = router;

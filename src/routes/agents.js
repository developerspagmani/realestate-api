const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const {
    createAgent,
    getAllAgents,
    updateAgent,
    deleteAgent,
    getAgentCommissions,
    getMyLeads,
    getMyCommissions,
    updateAgentLeadStatus,
    getMyProfile,
    assignProperty,
    getAgentProperties,
    unassignProperty,
    assignLead,
    getAgentLeads,
    unassignLead
} = require('../controllers/agentController');

// All routes require authentication
router.use(auth);

// --- Agent Dashboard Routes (Role 4) - Specific paths first! ---
// Get own profile
router.get('/my/profile', authorize('AGENT'), getMyProfile);

// Get own leads
router.get('/my/leads', authorize('AGENT'), getMyLeads);

// Get own commissions
router.get('/my/commissions', authorize('AGENT'), getMyCommissions);

// Update lead status (Agent)
router.patch('/my/leads/:id/status', authorize('AGENT'), validate(schemas.updateAgentLeadStatus), updateAgentLeadStatus);

// --- Owner/Admin Routes ---
// Get all agents (Admin/Owner)
router.get('/', authorize('ADMIN', 'OWNER'), getAllAgents);

// Create agent (Owner/Admin)
router.post('/', authorize('ADMIN', 'OWNER'), validate(schemas.createAgent), createAgent);

// Update agent (Owner/Admin)
router.put('/:id', authorize('ADMIN', 'OWNER'), validate(schemas.updateAgent), updateAgent);

// Delete agent (Owner/Admin)
router.delete('/:id', authorize('ADMIN', 'OWNER'), deleteAgent);

// Get agent commissions (Owner/Admin)
router.get('/:id/commissions', authorize('ADMIN', 'OWNER'), getAgentCommissions);

// --- Assignment Routes ---
// Assign property to agent
router.post('/assignments', authorize('ADMIN', 'OWNER'), validate(schemas.assignProperty), assignProperty);

// Get agent assigned properties
router.get('/:id/assignments', authorize('ADMIN', 'OWNER'), getAgentProperties);

// Unassign property (delete assignment record)
router.delete('/assignments/:id', authorize('ADMIN', 'OWNER'), unassignProperty);

// --- Lead Assignment Routes ---
// Assign lead to agent
router.post('/lead-assignments', authorize('ADMIN', 'OWNER'), validate(schemas.assignLead), assignLead);

// Get agent assigned leads
router.get('/:id/lead-assignments', authorize('ADMIN', 'OWNER'), getAgentLeads);

// Unassign lead (delete assignment record)
router.delete('/lead-assignments/:id', authorize('ADMIN', 'OWNER'), unassignLead);

module.exports = router;

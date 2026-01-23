const express = require('express');
const { validate, schemas } = require('../middleware/validation');
const { auth, authorize } = require('../middleware/auth');
const {
  getAllLeads,
  getLeadById,
  createLead,
  updateLead,
  updateLeadStatus,
  deleteLead,
  getLeadStats,
} = require('../controllers/leadsController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Lead routes
router.post('/', authorize(2, 3), validate(schemas.createLead), createLead);
router.get('/', authorize(2, 3), getAllLeads);
router.get('/stats', authorize(2, 3), getLeadStats);
router.get('/:id', authorize(2, 3), getLeadById);
router.put('/:id', authorize(2, 3), validate(schemas.updateLead), updateLead);
router.put('/:id/status', authorize(2, 3), validate(schemas.updateLeadStatus), updateLeadStatus);
router.delete('/:id', authorize(2, 3), deleteLead);

module.exports = router;

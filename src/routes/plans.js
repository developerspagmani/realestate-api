const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const {
    getAllPlans,
    createPlan,
    updatePlan,
    deletePlan
} = require('../controllers/planController');

const router = express.Router();

// Public route to get plans for registration
router.get('/', getAllPlans);

// Admin routes
router.post('/', auth, authorize('ADMIN'), createPlan);
router.put('/:id', auth, authorize('ADMIN'), updatePlan);
router.delete('/:id', auth, authorize('ADMIN'), deletePlan);

module.exports = router;

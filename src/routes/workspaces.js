const express = require('express');
const { validate, schemas } = require('../middleware/validation');
const { auth, authorize } = require('../middleware/auth');
const {
  getSeats,
  getWorkspaceById,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceAvailability,
} = require('../controllers/workspaceController');

const router = express.Router();

// Public routes
router.get('/', getSeats);
router.get('/:id', getWorkspaceById);
router.get('/:id/availability', getWorkspaceAvailability);

// Protected routes (Admin/Owner only)
router.post('/', auth, authorize(2, 3), validate(schemas.createWorkspace), createWorkspace);
router.put('/:id', auth, authorize(2, 3), validate(schemas.updateWorkspace), updateWorkspace);
router.delete('/:id', auth, authorize(2, 3), deleteWorkspace);

module.exports = router;

const express = require('express');
const { validate, schemas } = require('../middleware/validation');
const { auth, authorize } = require('../middleware/auth');
const {
  createUnit,
  getUnits,
  getUnitById,
  updateUnit,
  deleteUnit
} = require('../controllers/unitController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Unit routes
router.post('/', validate(schemas.createUnit), authorize(1, 2, 3), createUnit);
router.get('/', getUnits);
router.get('/:id', getUnitById);
router.put('/:id', authorize(2, 3), validate(schemas.updateUnit), updateUnit);
router.delete('/:id', authorize(2, 3), deleteUnit);

module.exports = router;

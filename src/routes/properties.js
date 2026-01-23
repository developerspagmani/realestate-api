const express = require('express');
const { validate, schemas } = require('../middleware/validation');
const { auth, authorize } = require('../middleware/auth');
const {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty
} = require('../controllers/propertyController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Property routes
router.post('/', validate(schemas.createProperty), authorize(2, 3), createProperty);
router.get('/', getProperties);
router.get('/:id', getPropertyById);
router.put('/:id', authorize(2, 3), validate(schemas.updateProperty), updateProperty);
router.delete('/:id', authorize(2, 3), deleteProperty);

module.exports = router;

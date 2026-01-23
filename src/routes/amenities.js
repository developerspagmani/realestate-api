const express = require('express');
const { auth } = require('../middleware/auth');
const {
    getAllAmenities,
    createAmenity,
    updateAmenity,
    deleteAmenity
} = require('../controllers/amenityController');

const router = express.Router();

// Apply authentication middleware
router.use(auth);

// Get all amenities
router.get('/', getAllAmenities);

// Create amenity
router.post('/', createAmenity);

// Update amenity
router.put('/:id', updateAmenity);

// Delete amenity
router.delete('/:id', deleteAmenity);

module.exports = router;

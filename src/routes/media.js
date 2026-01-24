const express = require('express');
const path = require('path');
const multer = require('multer');
const { auth, authorize } = require('../middleware/auth');

const fs = require('fs');

// Configure multer storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const {
  getAllMedia,
  getMediaById,
  uploadMedia,
  updateMedia,
  deleteMedia,
  getMediaStats,
} = require('../controllers/mediaController');

const router = express.Router();

// All routes are protected
router.use(auth);

// Media CRUD operations
router.get('/', authorize(2, 3), getAllMedia);
router.get('/stats', authorize(2, 3), getMediaStats);
router.get('/:id', authorize(2, 3), getMediaById);
router.post('/', authorize(2, 3), upload.single('file'), uploadMedia);
router.put('/:id', authorize(2, 3), updateMedia);
router.delete('/:id', authorize(2, 3), deleteMedia);

module.exports = router;

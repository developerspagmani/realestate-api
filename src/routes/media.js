const express = require('express');
const path = require('path');
const multer = require('multer');
const { auth, authorize } = require('../middleware/auth');
const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } = require('../constants');

const fs = require('fs');

// SEC-05 fix: Configure multer with file type and size validation
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: images, videos, audio, PDF, and office documents.`), false);
    }
  }
});

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

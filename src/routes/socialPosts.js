const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const {
  getAllSocialPosts,
  getSocialPostById,
  createSocialPost,
  updateSocialPost,
  deleteSocialPost,
  publishSocialPost,
  getSocialMediaStats,
} = require('../controllers/socialPostController');

const router = express.Router();

// All routes are protected
router.use(auth);

// Social post CRUD operations
router.get('/', getAllSocialPosts);
router.get('/stats', getSocialMediaStats);
router.get('/:id', getSocialPostById);
router.post('/', authorize(2, 3), createSocialPost);
router.put('/:id', authorize(2, 3), updateSocialPost);
router.delete('/:id', authorize(2, 3), deleteSocialPost);
router.post('/:id/publish', authorize(2, 3), publishSocialPost);

module.exports = router;

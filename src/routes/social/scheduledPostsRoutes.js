const express = require('express');
const router = express.Router();
const scheduledPostsController = require('../../controllers/social/scheduledPostsController');

// Create scheduled post
router.post('/', scheduledPostsController.createScheduledPost);

// Create draft
router.post('/drafts', scheduledPostsController.createDraft);

// Get all scheduled posts
router.get('/', scheduledPostsController.getScheduledPosts);

// Get all drafts
router.get('/drafts', scheduledPostsController.getDrafts);

// Get statistics
router.get('/stats', scheduledPostsController.getStats);

// Get posts by property
router.get('/property/:propertyId', scheduledPostsController.getPostsByProperty);

// Get specific scheduled post
router.get('/:id', scheduledPostsController.getScheduledPostById);

// Update scheduled post
router.put('/:id', scheduledPostsController.updateScheduledPost);

// Delete scheduled post
router.delete('/:id', scheduledPostsController.deleteScheduledPost);

// Publish post immediately
router.post('/:id/publish', scheduledPostsController.publishNow);

module.exports = router;

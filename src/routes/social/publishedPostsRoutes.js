const express = require('express');
const router = express.Router();
const publishedPostsController = require('../../controllers/social/publishedPostsController');

// Get all published posts
router.get('/', publishedPostsController.getPublishedPosts);

// Get statistics
router.get('/stats', publishedPostsController.getPublishedStats);

// Get posts by property
router.get('/property/:propertyId', publishedPostsController.getPublishedPostsByProperty);

// Get specific published post
router.get('/:id', publishedPostsController.getPublishedPostById);

// Update post metrics
router.put('/:id/metrics', publishedPostsController.updateMetrics);

// Refresh post metrics from platform
router.post('/:id/refresh', publishedPostsController.refreshPostMetrics);

// Get detailed engagement (real-time comments etc)
router.get('/:id/engagement', publishedPostsController.getPostEngagementDetails);

// Delete published post record
router.delete('/:id', publishedPostsController.deletePublishedPost);

module.exports = router;

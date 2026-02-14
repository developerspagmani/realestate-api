const express = require('express');
const router = express.Router();
const cmsController = require('../controllers/cmsController');
const { createPage, updatePage } = require('../validations/cmsValidation');
const { validate } = require('../middleware/validation');
const { auth } = require('../middleware/auth');

// Public route to get a page by slug
router.get('/public/:slug', cmsController.getPublicPage);

// Protected routes
router.use(auth);

router.get('/', cmsController.getPages);
router.get('/:id', cmsController.getPageById);
router.post('/', validate(createPage), cmsController.createPage);
router.put('/:id', validate(updatePage), cmsController.updatePage);
router.delete('/:id', cmsController.deletePage);

module.exports = router;

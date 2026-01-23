const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const {
  getAllCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  launchCampaign,
  getCampaignStats,
} = require('../controllers/campaignController');

const router = express.Router();

// All routes are protected
router.use(auth);

// Campaign CRUD operations
router.get('/', getAllCampaigns);
router.get('/stats', getCampaignStats);
router.get('/:id', getCampaignById);
router.post('/', authorize(2, 3), createCampaign);
router.put('/:id', authorize(2, 3), updateCampaign);
router.delete('/:id', authorize(2, 3), deleteCampaign);
router.post('/:id/launch', authorize(2, 3), launchCampaign);

module.exports = router;

const express = require('express');
const router = express.Router();
const whatsappController = require('../../controllers/social/whatsappController');

// Templates
router.get('/templates', whatsappController.getTemplates);
router.post('/templates', whatsappController.createTemplate);
router.post('/templates/sync', whatsappController.syncTemplates);
router.get('/templates/:id', whatsappController.getTemplateById);
router.delete('/templates/:id', whatsappController.deleteTemplate);

// Campaigns
router.get('/campaigns', whatsappController.getCampaigns);
router.post('/campaigns', whatsappController.createCampaign);
router.get('/campaigns/:id', whatsappController.getCampaignById);
router.get('/campaigns/:id/stats', whatsappController.getCampaignStats);

// Messages
router.get('/messages', whatsappController.getMessages);
router.post('/messages', whatsappController.sendMessage);

// Webhook (no authentication required for webhook endpoints)
router.get('/webhook', whatsappController.verifyWebhook);
router.post('/webhook', whatsappController.handleWebhook);

module.exports = router;

const express = require('express');
const router = express.Router();
const whatsappController = require('../../controllers/social/whatsappController');

const { auth } = require('../../middleware/auth');

// Apply authentication to management routes
router.use((req, res, next) => {
    // Exclude webhook routes from authentication
    // Convert to string and handle potential trailing slashes
    const path = req.path.toLowerCase();
    if (path === '/webhook' || path === '/webhook/') {
        return next();
    }

    auth(req, res, next);
});

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
router.patch('/campaigns/:id', whatsappController.updateCampaign);
router.delete('/campaigns/:id', whatsappController.deleteCampaign);
router.get('/campaigns/:id/stats', whatsappController.getCampaignStats);

// Messages
router.get('/messages', whatsappController.getMessages);
router.post('/messages', whatsappController.sendMessage);

// Meta Info (Account details)
router.get('/business/:wabaId', whatsappController.getBusinessInfo);
router.get('/phone/:phoneId', whatsappController.getPhoneInfo);

// Webhook (no authentication required for internal verification, but management needs auth)
router.get('/webhook/info', whatsappController.getWebhookInfo);
router.get('/webhook', whatsappController.verifyWebhook);
router.post('/webhook', whatsappController.handleWebhook);

module.exports = router;

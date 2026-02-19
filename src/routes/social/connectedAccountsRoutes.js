const express = require('express');
const router = express.Router();
const connectedAccountsController = require('../../controllers/social/connectedAccountsController');

// Connect a new account
router.post('/connect', connectedAccountsController.connectAccount);

// Get all connected accounts
router.get('/', connectedAccountsController.getConnectedAccounts);

// Get connection statistics
router.get('/stats', connectedAccountsController.getConnectionStats);

// Get account by platform
router.get('/platform/:platform', connectedAccountsController.getAccountByPlatform);

// Get specific account
router.get('/:id', connectedAccountsController.getConnectedAccountById);

// Update account tokens
router.put('/:id/tokens', connectedAccountsController.updateAccountTokens);

// Refresh account token
router.post('/:id/refresh', connectedAccountsController.refreshAccountToken);

// Disconnect account
router.delete('/:id', connectedAccountsController.disconnectAccount);

// OAuth exchange endpoints
router.post('/meta/exchange', connectedAccountsController.exchangeMetaCode);
router.post('/google/exchange', connectedAccountsController.exchangeGoogleCode);

module.exports = router;

const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

// Public route for Property 3D configuration (for widgets)
router.get('/public/:propertyId', async (req, res) => {
    try {
        const { propertyId } = req.params;
        const config = await prisma.property3DConfig.findUnique({
            where: { propertyId }
        });

        if (!config || config.status !== 1) {
            return res.status(404).json({ success: false, message: '3D Configuration not found or inactive.' });
        }

        res.json({ success: true, data: config });
    } catch (error) {
        console.error('Error fetching public 3D config:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get 3D config for a property (Authenticated)
router.get('/:propertyId', auth, async (req, res) => {
    try {
        const { propertyId } = req.params;
        const config = await prisma.property3DConfig.findUnique({
            where: { propertyId }
        });
        res.json({ success: true, data: config });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create/Update 3D config (Admin only)
router.post('/:propertyId', auth, authorize(2), async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { config, layout, tourData, status } = req.body;

        const updated = await prisma.property3DConfig.upsert({
            where: { propertyId },
            update: {
                config,
                layout,
                tourData,
                status,
                updatedAt: new Date()
            },
            create: {
                propertyId,
                config,
                layout,
                tourData,
                status
            }
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('Error saving 3D config:', error);
        res.status(500).json({ success: false, message: 'Server error saving 3D config.' });
    }
});

module.exports = router;

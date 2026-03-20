const { prisma } = require('../config/database');

const popupController = {
    // Get all popups for a tenant
    getPopups: async (req, res) => {
        try {
            const { tenantId: queryTenantId } = req.query;
            const isAdmin = req.user.role === 2;
            const tenantId = queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

            const where = {
                ...(tenantId ? { tenantId } : {})
            };

            const popups = await prisma.websitePopup.findMany({
                where,
                orderBy: { createdAt: 'desc' }
            });

            res.json({
                success: true,
                data: popups
            });
        } catch (error) {
            console.error('Error fetching popups:', error);
            res.status(500).json({ success: false, message: 'Server error fetching popups.' });
        }
    },

    // Get a single popup
    getPopupById: async (req, res) => {
        try {
            const { id } = req.params;
            const { tenantId: queryTenantId } = req.query;
            const isAdmin = req.user.role === 2;
            const tenantId = queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

            const where = { id };
            if (tenantId) where.tenantId = tenantId;

            const popup = await prisma.websitePopup.findFirst({
                where
            });

            if (!popup) {
                return res.status(404).json({ success: false, message: 'Popup not found.' });
            }

            res.json({ success: true, data: popup });
        } catch (error) {
            console.error('Error fetching popup:', error);
            res.status(500).json({ success: false, message: 'Server error fetching popup.' });
        }
    },

    // Create a new popup
    createPopup: async (req, res) => {
        try {
            const { name, websiteId, type, trigger, triggerValue, content, isActive, targetWidgetIds, tenantId: bodyTenantId } = req.body;
            const isAdmin = req.user.role === 2;
            const finalTenantId = (isAdmin && bodyTenantId) ? bodyTenantId : (req.tenant?.id || req.user?.tenantId);

            // Ensure targetWidgetIds is persisted inside content if provided at top level
            const finalContent = content || {};
            if (targetWidgetIds !== undefined) {
                finalContent.targetWidgetIds = targetWidgetIds;
            }

            if (!websiteId) {
                return res.status(400).json({ success: false, message: 'Website ID is required.' });
            }

            const popup = await prisma.websitePopup.create({
                data: {
                    name,
                    websiteId,
                    type,
                    trigger,
                    triggerValue: triggerValue || null,
                    content: finalContent,
                    isActive: isActive !== undefined ? isActive : true,
                    tenantId: finalTenantId
                }
            });

            res.status(201).json({ success: true, data: popup });
        } catch (error) {
            console.error('Error creating popup:', error);
            res.status(500).json({ success: false, message: 'Server error creating popup.' });
        }
    },

    // Update a popup
    updatePopup: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, websiteId, type, trigger, triggerValue, content, isActive, targetWidgetIds, tenantId: bodyTenantId } = req.body;
            const { tenantId: queryTenantId } = req.query;
            const isAdmin = req.user.role === 2;

            const effectiveTenantId = bodyTenantId || queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

            const where = { id };
            if (effectiveTenantId) where.tenantId = effectiveTenantId;

            const updateData = {};
            if (name !== undefined) updateData.name = name;
            if (websiteId !== undefined) updateData.websiteId = websiteId;
            if (type !== undefined) updateData.type = type;
            if (trigger !== undefined) updateData.trigger = trigger;
            if (triggerValue !== undefined) updateData.triggerValue = triggerValue;
            if (content !== undefined) updateData.content = content;
            if (isActive !== undefined) updateData.isActive = isActive;

            // Handle syncing targetWidgetIds to content field
            if (targetWidgetIds !== undefined) {
                if (!updateData.content) {
                    // Fetch existing content if not being updated directly
                    const existing = await prisma.websitePopup.findUnique({ where: { id }, select: { content: true } });
                    updateData.content = existing?.content || {};
                }
                updateData.content = {
                    ...updateData.content,
                    targetWidgetIds
                };
            }

            const popup = await prisma.websitePopup.updateMany({
                where,
                data: updateData
            });

            if (popup.count === 0) {
                return res.status(404).json({ success: false, message: 'Popup not found or unauthorized.' });
            }

            const updatedPopup = await prisma.websitePopup.findUnique({ where: { id } });

            res.json({ success: true, data: updatedPopup });
        } catch (error) {
            console.error('Error updating popup:', error);
            res.status(500).json({ success: false, message: 'Server error updating popup.' });
        }
    },

    // Delete a popup
    deletePopup: async (req, res) => {
        try {
            const { id } = req.params;
            const { tenantId: queryTenantId } = req.query;
            const isAdmin = req.user.role === 2;
            const effectiveTenantId = queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

            const where = { id };
            if (effectiveTenantId) where.tenantId = effectiveTenantId;

            const result = await prisma.websitePopup.deleteMany({
                where
            });

            if (result.count === 0) {
                return res.status(404).json({ success: false, message: 'Popup not found or unauthorized.' });
            }

            res.json({ success: true, message: 'Popup deleted successfully.' });
        } catch (error) {
            console.error('Error deleting popup:', error);
            res.status(500).json({ success: false, message: 'Server error deleting popup.' });
        }
    },

    // Public: Get active popups for a website
    getPublicPopups: async (req, res) => {
        try {
            const { websiteId, widgetId } = req.params;

            const where = {
                isActive: true
            };

            if (widgetId && widgetId !== 'none' && widgetId !== 'undefined') {
                // IMPORTANT: widgetId in URL is the widget's uniqueId string, but targetWidgetIds stores the internal DB UUID
                const widget = await prisma.widget.findUnique({
                    where: { uniqueId: widgetId },
                    select: { id: true }
                });

                if (widget) {
                    where.content = {
                        path: ['targetWidgetIds'],
                        array_contains: widget.id
                    };
                } else {
                    // If widget NOT found by uniqueId, try by internal ID just in case
                    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
                    if (uuidRegex.test(widgetId)) {
                        where.content = {
                            path: ['targetWidgetIds'],
                            array_contains: widgetId
                        };
                    } else {
                        return res.json({ success: true, data: [] });
                    }
                }
            } else if (websiteId && websiteId !== 'none' && websiteId !== 'all' && websiteId !== 'undefined') {
                // If fetching for a specific website
                where.websiteId = websiteId;
            }

            const popups = await prisma.websitePopup.findMany({
                where
            });

            res.json({
                success: true,
                data: popups
            });
        } catch (error) {
            console.error('Error fetching public popups:', error);
            res.status(500).json({ success: false, message: 'Error loading popups.' });
        }
    },

    // Get popup submissions (Audience)
    getPopupSubmissions: async (req, res) => {
        try {
            const { id } = req.params;
            const { tenantId: queryTenantId } = req.query;
            const isAdmin = req.user.role === 2;
            const tenantId = queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }

            // Find interactions for this popup
            const submissions = await prisma.leadInteraction.findMany({
                where: {
                    tenantId,
                    type: 'POPUP_SUBMIT',
                    metadata: {
                        path: ['popupId'],
                        equals: id
                    }
                },
                include: {
                    lead: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                            status: true,
                            source: true,
                            createdAt: true
                        }
                    }
                },
                orderBy: { occurredAt: 'desc' }
            });

            // Also get some basic metrics: Views
            const viewCount = await prisma.leadInteraction.count({
                where: {
                    tenantId,
                    type: 'POPUP_VIEW',
                    metadata: {
                        path: ['popupId'],
                        equals: id
                    }
                }
            });

            res.json({
                success: true,
                data: submissions,
                metrics: {
                    views: viewCount,
                    submissions: submissions.length,
                    conversionRate: viewCount > 0 ? (submissions.length / viewCount * 100).toFixed(2) : 0
                }
            });
        } catch (error) {
            console.error('Error fetching popup submissions:', error);
            res.status(500).json({ success: false, message: 'Server error fetching submissions.' });
        }
    }
};

module.exports = popupController;

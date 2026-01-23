const { prisma } = require('../config/database');

const widgetController = {
    // Get all widgets for the current tenant
    getWidgets: async (req, res) => {
        try {
            const { tenantId: queryTenantId, propertyId } = req.query;
            const isAdmin = req.user.role === 2;
            const tenantId = queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

            const where = {
                ...(tenantId ? { tenantId } : {}),
                ...(propertyId ? { propertyId } : {})
            };

            const widgets = await prisma.widget.findMany({
                where,
                include: {
                    property: {
                        select: {
                            id: true,
                            title: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            res.json({
                success: true,
                data: widgets
            });
        } catch (error) {
            console.error('Error fetching widgets:', error);
            res.status(500).json({ success: false, message: 'Server error fetching widgets.' });
        }
    },

    // Get a single widget
    getWidgetById: async (req, res) => {
        try {
            const { id } = req.params;
            const { tenantId: queryTenantId } = req.query;
            const isAdmin = req.user.role === 2;
            const tenantId = queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

            const where = { id };
            if (tenantId) where.tenantId = tenantId;

            const widget = await prisma.widget.findFirst({
                where
            });

            if (!widget) {
                return res.status(404).json({ success: false, message: 'Widget not found.' });
            }

            res.json({ success: true, data: widget });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Server error fetching widget.' });
        }
    },

    // Create a new widget
    createWidget: async (req, res) => {
        try {
            const { name, type, configuration, uniqueId, propertyId, tenantId: bodyTenantId } = req.body;
            const isAdmin = req.user.role === 2;
            const tenantId = bodyTenantId || req.tenant?.id || (isAdmin ? req.user?.tenantId : req.user?.tenantId);
            // Better: if admin provides a tenantId in body, use it.
            const finalTenantId = (isAdmin && bodyTenantId) ? bodyTenantId : (req.tenant?.id || req.user?.tenantId);

            // Ensure uniqueId is actually unique across the platform
            const existing = await prisma.widget.findUnique({ where: { uniqueId } });
            if (existing) {
                return res.status(400).json({ success: false, message: 'Widget Unique ID already exists.' });
            }

            const widget = await prisma.widget.create({
                data: {
                    name,
                    type,
                    configuration,
                    uniqueId,
                    tenantId: finalTenantId,
                    propertyId
                }
            });

            res.status(201).json({ success: true, data: widget });
        } catch (error) {
            console.error('Error creating widget:', error);
            res.status(500).json({ success: false, message: 'Server error creating widget.' });
        }
    },

    // Update a widget
    updateWidget: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, type, configuration, status, propertyId, tenantId: bodyTenantId } = req.body;
            const { tenantId: queryTenantId } = req.query;
            const isAdmin = req.user.role === 2;

            // Resolve which tenant context we are in
            const effectiveTenantId = bodyTenantId || queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

            const where = { id };
            if (effectiveTenantId) where.tenantId = effectiveTenantId;

            const widget = await prisma.widget.updateMany({
                where,
                data: {
                    name,
                    type,
                    configuration,
                    status,
                    propertyId
                }
            });

            if (widget.count === 0) {
                return res.status(404).json({ success: false, message: 'Widget not found or unauthorized.' });
            }

            const updatedWidget = await prisma.widget.findUnique({ where: { id } });

            res.json({ success: true, data: updatedWidget });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Server error updating widget.' });
        }
    },

    // Delete a widget
    deleteWidget: async (req, res) => {
        try {
            const { id } = req.params;
            const { tenantId: queryTenantId } = req.query;
            const isAdmin = req.user.role === 2;
            const effectiveTenantId = queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

            const where = { id };
            if (effectiveTenantId) where.tenantId = effectiveTenantId;

            const result = await prisma.widget.deleteMany({
                where
            });

            if (result.count === 0) {
                return res.status(404).json({ success: false, message: 'Widget not found or unauthorized.' });
            }

            res.json({ success: true, message: 'Widget deleted successfully.' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Server error deleting widget.' });
        }
    },

    // Public: Get widget data for renderer
    getPublicWidget: async (req, res) => {
        try {
            const { uniqueId } = req.params;

            const widget = await prisma.widget.findUnique({
                where: { uniqueId },
                include: {
                    tenant: {
                        select: {
                            name: true,
                            type: true
                        }
                    }
                }
            });

            if (!widget || widget.status !== 1) {
                return res.status(404).json({ success: false, message: 'Widget not found or inactive.' });
            }

            // Fetch the items based on widget configuration
            // Prioritize the top-level propertyId column
            const propertyId = widget.propertyId || widget.configuration.settings?.propertyId;

            const properties = await prisma.property.findMany({
                where: {
                    tenantId: widget.tenantId,
                    status: 1,
                    ...(propertyId ? { id: propertyId } : {})
                },
                include: {
                    mainImage: true,
                    workspace3D: true,
                    floorPlan: true,
                    brochure: true,
                    propertyAmenities: {
                        include: { amenity: true }
                    },
                    units: {
                        where: { status: 1 },
                        include: {
                            unitPricing: true,
                            coworkingDetails: true,
                            realEstateDetails: true,
                            unitAmenities: {
                                include: { amenity: true }
                            },
                            mainImage: true
                        }
                    }
                },
                take: 10
            });

            res.json({
                success: true,
                widget,
                data: properties
            });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Error loading widget.' });
        }
    },

    // Public: Capture a lead from the widget
    captureLead: async (req, res) => {
        try {
            const { uniqueId } = req.params;
            const { name, contact, email: bodyEmail, phone: bodyPhone, source, notes, propertyId, unitId } = req.body;

            const widget = await prisma.widget.findUnique({
                where: { uniqueId }
            });

            if (!widget) {
                return res.status(404).json({ success: false, message: 'Widget not found.' });
            }

            let email = bodyEmail ? bodyEmail.toLowerCase() : undefined;
            let phone = bodyPhone;

            // Fallback to contact field if email/phone not explicitly provided (e.g. from chatbot)
            if (contact && !email && !phone) {
                const isEmail = contact.includes('@');
                if (isEmail) {
                    email = contact.toLowerCase();
                } else {
                    phone = contact;
                }
            }

            // Upsert or Check-Update to avoid duplicates for the same person
            // We search for an existing lead with the same email or phone in this tenant
            let lead = await prisma.lead.findFirst({
                where: {
                    tenantId: widget.tenantId,
                    OR: [
                        ...(email ? [{ email }] : []),
                        ...(phone ? [{ phone }] : [])
                    ]
                }
            });

            if (lead) {
                // Update existing lead notes with new activity
                lead = await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                        notes: (lead.notes || '') + `\n[Update] Re-engaged via ${source === 'widget_chatbot' ? 'chatbot' : 'widget form'}.`,
                        updatedAt: new Date(),
                        propertyId: propertyId || lead.propertyId,
                        unitId: unitId || lead.unitId
                    }
                });
            } else {
                // Create new lead
                lead = await prisma.lead.create({
                    data: {
                        name: name || (source === 'widget_chatbot' ? 'Chatbot User' : 'Web Inquiry'),
                        email,
                        phone,
                        source: source === 'widget_chatbot' ? 7 : (Number(source) || 1),
                        notes: notes || 'Lead captured from widget.',
                        tenantId: widget.tenantId,
                        propertyId,
                        unitId,
                        status: 1 // New
                    }
                });
            }

            res.json({ success: true, data: lead });
        } catch (error) {
            console.error('Error capturing lead:', error);
            res.status(500).json({ success: false, message: 'Error capturing lead.' });
        }
    }
};

module.exports = widgetController;

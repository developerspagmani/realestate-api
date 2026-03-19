const { prisma } = require('../config/database');
const { assignLeadRoundRobin } = require('./agentController');
const { sendLeadEmail, sendBookingEmail } = require('../utils/emailService');

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
        } catch (_error) {
            res.status(500).json({ success: false, message: 'Server error fetching widget.' });
        }
    },

    // Create a new widget
    createWidget: async (req, res) => {
        try {
            const { name, type, configuration, uniqueId, propertyId, tenantId: bodyTenantId } = req.body;
            const isAdmin = req.user.role === 2;
            const finalTenantId = (isAdmin && bodyTenantId) ? bodyTenantId : (req.tenant?.id || req.user?.tenantId);

            // Ensure uniqueId is actually unique across the platform
            const existing = await prisma.widget.findUnique({ where: { uniqueId } });
            if (existing) {
                return res.status(400).json({ success: false, message: 'Widget Unique ID already exists.' });
            }

            // Sanitize UUID
            const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
            const safePropertyId = (propertyId && uuidRegex.test(propertyId)) ? propertyId : null;

            const widget = await prisma.widget.create({
                data: {
                    name,
                    type,
                    configuration,
                    uniqueId,
                    tenantId: finalTenantId,
                    propertyId: safePropertyId
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

            // Sanitize UUID
            const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
            const safePropertyId = (propertyId && uuidRegex.test(propertyId)) ? propertyId : null;

            const widget = await prisma.widget.updateMany({
                where,
                data: {
                    ...(name && { name }),
                    ...(type && { type }),
                    ...(configuration && { configuration }),
                    ...(status !== undefined && { status: Number(status) }),
                    propertyId: safePropertyId
                }
            });

            if (widget.count === 0) {
                return res.status(404).json({ success: false, message: 'Widget not found or unauthorized.' });
            }

            const updatedWidget = await prisma.widget.findUnique({ where: { id } });

            res.json({ success: true, data: updatedWidget });
        } catch (error) {
            console.error('Error updating widget:', error);
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
        } catch (_error) {
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
                            type: true,
                            country: true
                        }
                    }
                }
            });

            if (!widget || widget.status !== 1) {
                return res.status(404).json({ success: false, message: 'Widget not found or inactive.' });
            }

            // Fetch the items based on widget configuration
            // Prioritize the top-level propertyId column
            const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
            let propertyId = widget.propertyId || widget.configuration.settings?.propertyId;
            if (propertyId && !uuidRegex.test(propertyId)) propertyId = null;

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

            // Resolve gallery IDs into full Media objects
            const allMediaIds = new Set();
            properties.forEach(p => {
                if (Array.isArray(p.gallery)) p.gallery.forEach(id => { if (typeof id === 'string') allMediaIds.add(id); });
                p.units.forEach(u => {
                    if (Array.isArray(u.gallery)) u.gallery.forEach(id => { if (typeof id === 'string') allMediaIds.add(id); });
                });
            });

            if (allMediaIds.size > 0) {
                const mediaItems = await prisma.media.findMany({
                    where: { id: { in: Array.from(allMediaIds) } }
                });

                const mediaMap = mediaItems.reduce((acc, current) => {
                    acc[current.id] = current;
                    return acc;
                }, {});

                // Replace IDs with objects
                properties.forEach(p => {
                    if (Array.isArray(p.gallery)) {
                        p.gallery = p.gallery.map(item => {
                            if (typeof item === 'string') {
                                if (mediaMap[item]) return mediaMap[item];
                                // If it looks like a URL but wasn't in media table, wrap it
                                if (item.includes('/') || item.includes('.')) return { url: item };
                                return null;
                            }
                            return item;
                        }).filter(item => item && typeof item === 'object' && item.url);
                    }
                    p.units.forEach(u => {
                        if (Array.isArray(u.gallery)) {
                            u.gallery = u.gallery.map(item => {
                                if (typeof item === 'string') {
                                    if (mediaMap[item]) return mediaMap[item];
                                    if (item.includes('/') || item.includes('.')) return { url: item };
                                    return null;
                                }
                                return item;
                            }).filter(item => item && typeof item === 'object' && item.url);
                        }
                    });
                });
            }

            res.json({
                success: true,
                widget,
                data: properties
            });
        } catch (error) {
            console.error('Error loading public widget:', error);
            res.status(500).json({ success: false, message: 'Error loading widget.' });
        }
    },

    // Public: Capture a lead from the widget
    captureLead: async (req, res) => {
        try {
            const { uniqueId } = req.params;
            const { name, contact, email: bodyEmail, phone: bodyPhone, source, notes, propertyId, unitId, startAt: bodyStartAt, endAt: bodyEndAt } = req.body;

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
                if (contact.includes('|')) {
                    const [e, p] = contact.split('|').map(s => s.trim());
                    email = e?.toLowerCase();
                    phone = p;
                } else if (contact.includes('@')) {
                    email = contact.toLowerCase();
                } else {
                    phone = contact;
                }
            }

            const isBooking = req.body.isBooking === true || req.body.isBooking === 'true';

            // Sanitize UUIDs
            const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
            const safePropertyId = (propertyId && uuidRegex.test(propertyId)) ? propertyId : null;
            const safeUnitId = (unitId && uuidRegex.test(unitId)) ? unitId : null;

            // Upsert or Check-Update to avoid duplicates for the same person
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
                // Preserve existing tags and add Booking if needed
                const currentPrefs = lead.preferences || {};
                const currentTags = Array.isArray(currentPrefs.tags) ? currentPrefs.tags : [];
                if (isBooking && !currentTags.includes('Booking')) {
                    currentTags.push('Booking');
                }

                lead = await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                        notes: (lead.notes || '') + `\n[Update] Re-engaged via ${source === 'widget_chatbot' ? 'chatbot' : (isBooking ? 'booking form' : 'widget form')}.`,
                        updatedAt: new Date(),
                        propertyId: safePropertyId || lead.propertyId,
                        unitId: safeUnitId || lead.unitId,
                        preferences: { ...currentPrefs, tags: currentTags }
                    }
                });
            } else {
                lead = await prisma.lead.create({
                    data: {
                        name: name || (source === 'widget_chatbot' ? 'Chatbot User' : 'Web Inquiry'),
                        email,
                        phone,
                        source: source === 'widget_chatbot' ? 7 : (Number(source) || 1),
                        notes: notes || (isBooking ? 'Booking request captured from widget.' : 'Lead captured from widget.'),
                        tenantId: widget.tenantId,
                        unitId: safeUnitId,
                        propertyId: safePropertyId,
                        status: 1,
                        preferences: isBooking ? { tags: ['Booking'] } : {}
                    }
                });
            }

            // Phase 1: Unified Lead Aggregator - Stop leakage by enriching lead with AI analysis
            if (notes || name) {
                try {
                    const leadNurtureService = require('../services/social/leadNurtureService');
                    await leadNurtureService.enrichLeadPreferences(lead.id, notes || `Inquiry from ${name}`, { budget: lead.budget });
                } catch (err) {
                    console.error('Error enriching lead via widget:', err);
                }
            }

            // Record the interaction and handle booking module entry
            const interactionType = isBooking ? 'BOOKING_REQUEST' : (source === 'widget_chatbot' ? 'CHAT_INIT' : 'FORM_SUBMIT');
            const scoreWeight = interactionType === 'CHAT_INIT' ? 10 : (isBooking ? 30 : 20);

            await prisma.$transaction(async (tx) => {
                await tx.leadInteraction.create({
                    data: {
                        leadId: lead.id,
                        tenantId: widget.tenantId,
                        type: interactionType,
                        metadata: {
                            notes: `Inquiry from ${source === 'widget_chatbot' ? 'Chatbot' : 'Widget'}.`,
                            propertyId: safePropertyId || lead.propertyId,
                            unitId: safeUnitId || null,
                            widgetId: widget.id
                        },
                        scoreWeight: scoreWeight
                    }
                });

                await tx.lead.update({
                    where: { id: lead.id },
                    data: {
                        leadScore: { increment: scoreWeight },
                        updatedAt: new Date()
                    }
                });

                // Create a booking record if it's a booking request
                if (isBooking) {
                    const qrCode = 'BK-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                    const startAt = bodyStartAt ? new Date(bodyStartAt) : new Date();
                    const endAt = bodyEndAt ? new Date(bodyEndAt) : new Date(startAt.getTime() + 60 * 60 * 1000);

                    await tx.booking.create({
                        data: {
                            tenantId: widget.tenantId,
                            propertyId: safePropertyId || null,
                            unitId: safeUnitId || null,
                            leadId: lead.id,
                            guestName: lead.name,
                            guestEmail: lead.email,
                            guestPhone: lead.phone,
                            userId: lead.userId || null,
                            startAt: startAt,
                            endAt: endAt,
                            status: 1, // pending
                            paymentStatus: 1, // pending
                            qrCode,
                            notes: `Automated entry from website booking module.\nSource: ${source || 'Website'}`
                        }
                    });

                }
            });

            // Auto-assign to agent using Round Robin
            try {
                const assignedAgent = await assignLeadRoundRobin(widget.tenantId, lead.id);
                if (assignedAgent) {
                    console.log(`Lead ${lead.id} auto-assigned to Agent ${assignedAgent.id}`);
                }
            } catch (assignError) {
                console.error('Error in auto-assignment:', assignError);
            }

            // Trigger FORM_SUBMITTED workflows
            try {
                const WorkflowService = require('../services/marketing/WorkflowService');
                const triggerType = isBooking ? 'LEAD_CREATED' : 'FORM_SUBMITTED';
                await WorkflowService.triggerWorkflows(widget.tenantId, lead.id, triggerType, { widgetId: widget.id });
            } catch (wfError) {
                console.error('Error triggering widget workflows:', wfError);
            }

            // Notifications
            try {
                const tenant = await prisma.tenant.findUnique({ where: { id: widget.tenantId } });
                const settings = tenant?.settings || {};

                // Notify Admin if enabled
                if (settings.notifications?.emailLeads) {
                    const owner = await prisma.user.findFirst({
                        where: { tenantId: widget.tenantId, role: 3 },
                        select: { email: true }
                    });
                    if (owner) {
                        await sendLeadEmail(owner.email, lead.name, {
                            email: lead.email,
                            phone: lead.phone,
                            message: lead.notes || notes
                        });
                    }
                }

                // Notify User if it's a booking
                if (isBooking && email) {
                    // Get unit/property details for email
                    const unit = unitId ? await prisma.unit.findUnique({
                        where: { id: unitId },
                        include: { property: true }
                    }) : null;

                    await sendBookingEmail(email, lead.name, {
                        unitCode: unit?.unitCode || 'Unit',
                        propertyName: unit?.property?.title || 'Property',
                        date: new Date().toLocaleDateString(),
                        price: 'FREE VISIT',
                        status: 'Pending Confirmation'
                    });
                }
            } catch (notifError) {
                console.error('Error in lead notifications:', notifError);
            }

            res.json({ success: true, data: lead });
        } catch (error) {
            console.error('Error capturing lead:', error);
            res.status(500).json({ success: false, message: 'Error capturing lead.' });
        }
    }
};

module.exports = widgetController;

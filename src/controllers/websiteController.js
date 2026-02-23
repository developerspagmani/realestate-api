const { prisma } = require('../config/database');

const websiteController = {
    // Get all websites for the current tenant
    getWebsites: async (req, res) => {
        try {
            const { tenantId: queryTenantId } = req.query;
            const isAdmin = req.user.role === 2;
            const tenantId = queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

            const where = {
                ...(tenantId ? { tenantId } : {})
            };

            const websites = await prisma.website.findMany({
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
                data: websites
            });
        } catch (error) {
            console.error('Error fetching websites:', error);
            res.status(500).json({ success: false, message: 'Server error fetching websites.' });
        }
    },

    // Get a single website
    getWebsiteById: async (req, res) => {
        try {
            const { id } = req.params;
            const { tenantId: queryTenantId } = req.query;
            const isAdmin = req.user.role === 2;
            const tenantId = queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

            const where = { id };
            if (tenantId) where.tenantId = tenantId;

            const website = await prisma.website.findFirst({
                where
            });

            if (!website) {
                return res.status(404).json({ success: false, message: 'Website not found.' });
            }

            res.json({ success: true, data: website });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Server error fetching website.' });
        }
    },

    // Create a new website
    createWebsite: async (req, res) => {
        try {
            const { name, configuration, slug, customDomain, propertyId, tenantId: bodyTenantId } = req.body;
            const isAdmin = req.user.role === 2;
            const finalTenantId = (isAdmin && bodyTenantId) ? bodyTenantId : (req.tenant?.id || req.user?.tenantId);

            // Ensure slug is unique
            const existingSlug = await prisma.website.findUnique({ where: { slug } });
            if (existingSlug) {
                return res.status(400).json({ success: false, message: 'Website Slug already exists.' });
            }

            // Ensure customDomain is unique if provided
            if (customDomain) {
                const existingDomain = await prisma.website.findUnique({ where: { customDomain } });
                if (existingDomain) {
                    return res.status(400).json({ success: false, message: 'Custom Domain already assigned to another website.' });
                }
            }

            const website = await prisma.website.create({
                data: {
                    name,
                    configuration,
                    slug,
                    customDomain: customDomain || null,
                    tenantId: finalTenantId || null,
                    propertyId: propertyId || null
                }
            });

            res.status(201).json({ success: true, data: website });
        } catch (error) {
            console.error('Error creating website:', error);
            res.status(500).json({ success: false, message: 'Server error creating website.' });
        }
    },

    // Update a website
    updateWebsite: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, configuration, slug, customDomain, status, propertyId, tenantId: bodyTenantId } = req.body;
            const { tenantId: queryTenantId } = req.query;
            const isAdmin = req.user.role === 2;

            const effectiveTenantId = bodyTenantId || queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

            const where = { id };
            if (effectiveTenantId) where.tenantId = effectiveTenantId;

            const website = await prisma.website.updateMany({
                where,
                data: {
                    name,
                    configuration,
                    slug,
                    customDomain: customDomain || null,
                    status,
                    propertyId: propertyId || null
                }
            });

            if (website.count === 0) {
                return res.status(404).json({ success: false, message: 'Website not found or unauthorized.' });
            }

            const updatedWebsite = await prisma.website.findUnique({ where: { id } });

            res.json({ success: true, data: updatedWebsite });
        } catch (error) {
            console.error('Error updating website:', error);
            res.status(500).json({ success: false, message: 'Server error updating website.' });
        }
    },

    // Delete a website
    deleteWebsite: async (req, res) => {
        try {
            const { id } = req.params;
            const { tenantId: queryTenantId } = req.query;
            const isAdmin = req.user.role === 2;
            const effectiveTenantId = queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

            const where = { id };
            if (effectiveTenantId) where.tenantId = effectiveTenantId;

            const result = await prisma.website.deleteMany({
                where
            });

            if (result.count === 0) {
                return res.status(404).json({ success: false, message: 'Website not found or unauthorized.' });
            }

            res.json({ success: true, message: 'Website deleted successfully.' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Server error deleting website.' });
        }
    },

    // Public: Get website data by slug OR customDomain
    getPublicWebsite: async (req, res) => {
        try {
            const { slugOrDomain } = req.params;

            const normalizedDomain = slugOrDomain.replace(/^www\./, '');
            const wwwDomain = `www.${normalizedDomain}`;

            const website = await prisma.website.findFirst({
                where: {
                    OR: [
                        { slug: slugOrDomain },
                        { customDomain: slugOrDomain },
                        // Try matching with/without www just in case
                        { customDomain: normalizedDomain },
                        { customDomain: wwwDomain }
                    ]
                },
                include: {
                    tenant: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                            settings: true,
                            country: true
                        }
                    }
                }
            });

            if (!website || website.status !== 1) {
                return res.status(404).json({ success: false, message: 'Website not found or inactive.' });
            }

            const propertyId = website.propertyId || website.configuration.settings?.propertyId;

            const properties = await prisma.property.findMany({
                where: {
                    tenantId: website.tenantId,
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
                take: 50
            });

            // PERF-FIX: Resolve gallery media IDs to objects (matching publicController behavior)
            // Collect all potential media IDs from all properties AND units
            const allMediaIds = new Set();
            properties.forEach(p => {
                if (p.gallery && Array.isArray(p.gallery)) {
                    p.gallery.forEach(item => {
                        if (typeof item === 'string') allMediaIds.add(item);
                    });
                }
                if (p.units && Array.isArray(p.units)) {
                    p.units.forEach(u => {
                        if (u.gallery && Array.isArray(u.gallery)) {
                            u.gallery.forEach(item => {
                                if (typeof item === 'string') allMediaIds.add(item);
                            });
                        }
                    });
                }
            });

            if (allMediaIds.size > 0) {
                const resolvedMedia = await prisma.media.findMany({
                    where: { id: { in: Array.from(allMediaIds) } }
                });

                // Map back to properties and units
                properties.forEach(p => {
                    // Property Gallery
                    if (p.gallery && Array.isArray(p.gallery)) {
                        p.gallery = p.gallery.map(item => {
                            if (typeof item === 'string') {
                                return resolvedMedia.find(m => m.id === item) || item;
                            }
                            return item;
                        });
                    }
                    // Unit Galleries
                    if (p.units && Array.isArray(p.units)) {
                        p.units.forEach(u => {
                            if (u.gallery && Array.isArray(u.gallery)) {
                                u.gallery = u.gallery.map(item => {
                                    if (typeof item === 'string') {
                                        return resolvedMedia.find(m => m.id === item) || item;
                                    }
                                    return item;
                                });
                            }
                        });
                    }
                });
            }

            res.json({
                success: true,
                website,
                data: properties
            });
        } catch (error) {
            console.error('Error loading public website:', error);
            res.status(500).json({ success: false, message: 'Error loading website.' });
        }
    },

    // Public: Capture lead from website (chatbot or forms)
    captureLead: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, email, phone, contact, notes, source, propertyId, unitId, isBooking: bodyIsBooking, startAt, endAt } = req.body;
            const isBooking = bodyIsBooking === true || bodyIsBooking === 'true';

            const website = await prisma.website.findUnique({ where: { id } });
            if (!website) return res.status(404).json({ success: false, message: 'Website not found.' });

            let finalEmail = email;
            let finalPhone = phone;

            // Fallback to contact field if email/phone not explicitly provided (e.g. from chatbot)
            if (contact && !finalEmail && !finalPhone) {
                if (contact.includes('|')) {
                    const [e, p] = contact.split('|').map(s => s.trim());
                    if (e) finalEmail = e.toLowerCase();
                    if (p) finalPhone = p;
                } else if (contact.includes('@')) {
                    finalEmail = contact.toLowerCase();
                } else {
                    finalPhone = contact;
                }
            }

            if (!finalEmail && !finalPhone) {
                return res.status(400).json({ success: false, message: 'Contact information required (email or phone).' });
            }

            // Upsert or Check-Update to avoid duplicates
            let lead = await prisma.lead.findFirst({
                where: {
                    tenantId: website.tenantId,
                    OR: [
                        ...(finalEmail ? [{ email: finalEmail }] : []),
                        ...(finalPhone ? [{ phone: finalPhone }] : [])
                    ]
                }
            });

            // Map source string to ID if needed
            let sourceId = Number(source);
            if (isNaN(sourceId)) {
                if (source === 'website_chatbot') sourceId = 7;
                else sourceId = 8; // Default to Website
            }

            if (lead) {
                lead = await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                        notes: (lead.notes || '') + `\n[Update] Re-engaged via Website: ${website.name}.`,
                        updatedAt: new Date(),
                        propertyId: propertyId || lead.propertyId,
                        unitId: unitId || lead.unitId
                    }
                });
            } else {
                lead = await prisma.lead.create({
                    data: {
                        name: name || 'Website Visitor',
                        email: finalEmail,
                        phone: finalPhone,
                        source: sourceId,
                        notes: notes || (isBooking ? 'Booking request captured from website.' : `Lead captured from website: ${website.name}`),
                        tenantId: website.tenantId,
                        propertyId: propertyId || website.propertyId,
                        unitId: unitId || null,
                        status: 1,
                        preferences: isBooking ? { tags: ['Booking'] } : {}
                    }
                });
            }

            // Sync with PropMatch Engine
            try {
                const leadNurtureService = require('../services/social/leadNurtureService');
                await leadNurtureService.enrichLeadPreferences(lead.id, notes || `Website inquiry`, { budget: lead.budget });
            } catch (err) {
                console.error('Error enriching lead via website:', err);
            }

            // Record the interaction and update lead score
            const interactionType = isBooking ? 'BOOKING_REQUEST' : (source === 'website_chatbot' ? 'CHAT_INIT' : 'FORM_SUBMIT');
            const scoreWeight = interactionType === 'CHAT_INIT' ? 10 : (isBooking ? 30 : 20);

            await prisma.$transaction(async (tx) => {
                await tx.leadInteraction.create({
                    data: {
                        leadId: lead.id,
                        type: interactionType,
                        metadata: {
                            notes: `Lead engaged via website recorded as ${interactionType}`,
                            propertyId: propertyId || lead.propertyId,
                            unitId: unitId || null,
                            websiteId: website.id,
                            isBooking,
                            startAt,
                            endAt
                        },
                        tenantId: website.tenantId,
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
            });

            // Trigger workflows
            try {
                const WorkflowService = require('../services/marketing/WorkflowService');
                const triggerType = isBooking ? 'LEAD_CREATED' : 'FORM_SUBMITTED';
                await WorkflowService.triggerWorkflows(website.tenantId, lead.id, triggerType, { websiteId: website.id });
            } catch (wfError) {
                console.error('Error triggering website workflows:', wfError);
            }

            res.status(201).json({ success: true, data: lead });
        } catch (error) {
            console.error('Error capturing lead from website:', error);
            res.status(500).json({ success: false, message: 'Error capturing lead.' });
        }
    }
};

module.exports = websiteController;

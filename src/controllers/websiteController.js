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
                    customDomain,
                    tenantId: finalTenantId,
                    propertyId
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
                    customDomain,
                    status,
                    propertyId
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

            const website = await prisma.website.findFirst({
                where: {
                    OR: [
                        { slug: slugOrDomain },
                        { customDomain: slugOrDomain }
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
                take: 50
            });

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
            const { name, email, phone, contact, notes, source, propertyId } = req.body;

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

            console.log('[CaptureLead] Processing:', { id, finalEmail, finalPhone, source });

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
                        propertyId: propertyId || lead.propertyId
                    }
                });
            } else {
                lead = await prisma.lead.create({
                    data: {
                        name: name || 'Website Visitor',
                        email: finalEmail,
                        phone: finalPhone,
                        source: sourceId,
                        notes: notes || `Lead captured from website: ${website.name}`,
                        tenantId: website.tenantId,
                        propertyId: propertyId || website.propertyId,
                        status: 1
                    }
                });
            }

            // Create interaction log
            await prisma.leadInteraction.create({
                data: {
                    leadId: lead.id,
                    type: 'FORM_SUBMIT',
                    notes: `Lead engaged via website: ${website.name}`,
                    tenantId: website.tenantId
                }
            });

            res.status(201).json({ success: true, data: lead });
        } catch (error) {
            console.error('Error capturing lead from website:', error);
            res.status(500).json({ success: false, message: 'Error capturing lead.' });
        }
    }
};

module.exports = websiteController;

const { prisma } = require('../config/database');

const cmsController = {
    // Get all pages for a tenant
    getPages: async (req, res) => {
        try {
            const { tenantId: queryTenantId } = req.query;
            const isAdmin = req.user.role === 2;
            const tenantId = queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

            const where = {
                ...(tenantId ? { tenantId } : {})
            };

            const pages = await prisma.page.findMany({
                where,
                include: {
                    featureImage: {
                        select: {
                            id: true,
                            url: true,
                            filename: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            res.json({
                success: true,
                data: pages
            });
        } catch (error) {
            console.error('Error fetching pages:', error);
            res.status(500).json({ success: false, message: 'Server error fetching pages.' });
        }
    },

    // Get a single page by ID
    getPageById: async (req, res) => {
        try {
            const { id } = req.params;
            const { tenantId: queryTenantId } = req.query;
            const isAdmin = req.user.role === 2;
            const tenantId = queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

            const where = { id };
            if (tenantId) where.tenantId = tenantId;

            const page = await prisma.page.findFirst({
                where,
                include: {
                    featureImage: true
                }
            });

            if (!page) {
                return res.status(404).json({ success: false, message: 'Page not found.' });
            }

            res.json({ success: true, data: page });
        } catch (error) {
            console.error('Error fetching page:', error);
            res.status(500).json({ success: false, message: 'Server error fetching page.' });
        }
    },

    // Create a new page
    createPage: async (req, res) => {
        try {
            const {
                title, slug, content, featureImageId,
                seoTitle, seoDescription, seoKeywords,
                status, publishedAt, tenantId: bodyTenantId
            } = req.body;

            const isAdmin = req.user.role === 2;
            const finalTenantId = (isAdmin && bodyTenantId) ? bodyTenantId : (req.tenant?.id || req.user?.tenantId);

            if (!finalTenantId) {
                return res.status(400).json({ success: false, message: 'Tenant ID is required.' });
            }

            // Check for unique slug within tenant (Wait, schema says @unique globally, let's keep it simple for now as per schema)
            const existingPage = await prisma.page.findUnique({ where: { slug } });
            if (existingPage) {
                return res.status(400).json({ success: false, message: 'Page Slug already exists. Please use a unique slug.' });
            }

            const page = await prisma.page.create({
                data: {
                    title,
                    slug,
                    content,
                    featureImageId,
                    seoTitle,
                    seoDescription,
                    seoKeywords,
                    status: status || 1,
                    publishedAt: status === 2 ? (publishedAt || new Date()) : null,
                    tenantId: finalTenantId
                }
            });

            res.status(201).json({ success: true, data: page });
        } catch (error) {
            console.error('Error creating page:', error);
            res.status(500).json({ success: false, message: 'Server error creating page.' });
        }
    },

    // Update a page
    updatePage: async (req, res) => {
        try {
            const { id } = req.params;
            const {
                title, slug, content, featureImageId,
                seoTitle, seoDescription, seoKeywords,
                status, publishedAt, tenantId: bodyTenantId
            } = req.body;

            const { tenantId: queryTenantId } = req.query;
            const isAdmin = req.user.role === 2;
            const effectiveTenantId = bodyTenantId || queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

            const where = { id };
            if (effectiveTenantId) where.tenantId = effectiveTenantId;

            // If slug is changing, check for uniqueness
            if (slug) {
                const existingPage = await prisma.page.findFirst({
                    where: {
                        slug,
                        NOT: { id }
                    }
                });
                if (existingPage) {
                    return res.status(400).json({ success: false, message: 'Page Slug already exists. Please use a unique slug.' });
                }
            }

            const updateData = {
                title,
                slug,
                content,
                featureImageId,
                seoTitle,
                seoDescription,
                seoKeywords,
                status,
                updatedAt: new Date()
            };

            if (status === 2 && !publishedAt) {
                updateData.publishedAt = new Date();
            } else if (publishedAt) {
                updateData.publishedAt = publishedAt;
            }

            const result = await prisma.page.updateMany({
                where,
                data: updateData
            });

            if (result.count === 0) {
                return res.status(404).json({ success: false, message: 'Page not found or unauthorized.' });
            }

            const updatedPage = await prisma.page.findUnique({
                where: { id },
                include: { featureImage: true }
            });

            res.json({ success: true, data: updatedPage });
        } catch (error) {
            console.error('Error updating page:', error);
            res.status(500).json({ success: false, message: 'Server error updating page.' });
        }
    },

    // Delete a page
    deletePage: async (req, res) => {
        try {
            const { id } = req.params;
            const { tenantId: queryTenantId } = req.query;
            const isAdmin = req.user.role === 2;
            const effectiveTenantId = queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);

            const where = { id };
            if (effectiveTenantId) where.tenantId = effectiveTenantId;

            const result = await prisma.page.deleteMany({
                where
            });

            if (result.count === 0) {
                return res.status(404).json({ success: false, message: 'Page not found or unauthorized.' });
            }

            res.json({ success: true, message: 'Page deleted successfully.' });
        } catch (error) {
            console.error('Error deleting page:', error);
            res.status(500).json({ success: false, message: 'Server error deleting page.' });
        }
    },

    // Public: Get page data by slug
    getPublicPage: async (req, res) => {
        try {
            const { slug } = req.params;

            const page = await prisma.page.findUnique({
                where: { slug },
                include: {
                    tenant: {
                        select: {
                            id: true,
                            name: true,
                            settings: true
                        }
                    },
                    featureImage: true
                }
            });

            if (!page || page.status !== 2) {
                return res.status(404).json({ success: false, message: 'Page not found or not published.' });
            }

            res.json({
                success: true,
                data: page
            });
        } catch (error) {
            console.error('Error loading public page:', error);
            res.status(500).json({ success: false, message: 'Error loading page.' });
        }
    }
};

module.exports = cmsController;

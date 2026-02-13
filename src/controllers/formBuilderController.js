const { prisma } = require('../config/database');

// Get all forms
const getAllForms = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.user?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'Tenant ID is required' });
        }

        const forms = await prisma.formBuilder.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({ success: true, data: forms });
    } catch (error) {
        console.error('Get all forms error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching forms' });
    }
};

// Create form
const createForm = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const { name, configuration, targetGroupId, status } = req.body;

        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'Tenant ID is required' });
        }

        const form = await prisma.formBuilder.create({
            data: {
                name,
                configuration: typeof configuration === 'string' ? JSON.parse(configuration) : (configuration || {}),
                targetGroupId: (targetGroupId && targetGroupId !== '') ? targetGroupId : null,
                status: status ? parseInt(status) : 1,
                tenantId
            }
        });

        res.status(201).json({ success: true, message: 'Form created successfully', data: form });
    } catch (error) {
        console.error('Create form error:', error);
        res.status(500).json({ success: false, message: 'Server error creating form' });
    }
};

// Delete form
const deleteForm = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        await prisma.formBuilder.deleteMany({
            where: { id, tenantId }
        });

        res.status(200).json({ success: true, message: 'Form deleted successfully' });
    } catch (error) {
        console.error('Delete form error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting form' });
    }
};

// Update form
const updateForm = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const { name, configuration, targetGroupId, status } = req.body;

        const form = await prisma.formBuilder.updateMany({
            where: { id, tenantId },
            data: {
                ...(name && { name }),
                ...(configuration && { configuration: typeof configuration === 'string' ? JSON.parse(configuration) : configuration }),
                targetGroupId: (targetGroupId !== undefined && targetGroupId !== '') ? targetGroupId : (targetGroupId === '' ? null : undefined),
                ...(status !== undefined && { status: parseInt(status) })
            }
        });

        res.status(200).json({ success: true, message: 'Form updated successfully', data: form });
    } catch (error) {
        console.error('Update form error:', error);
        res.status(500).json({ success: false, message: 'Server error updating form' });
    }
};

// Get form for public view (unauthenticated)
const getFormPublic = async (req, res) => {
    try {
        const { id } = req.params;
        const form = await prisma.formBuilder.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                configuration: true,
                status: true
            }
        });

        if (!form || form.status === 0) {
            return res.status(404).json({ success: false, message: 'Form not found or inactive' });
        }

        res.status(200).json({ success: true, data: form });
    } catch (error) {
        console.error('Get public form error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching form' });
    }
};

module.exports = {
    getAllForms,
    createForm,
    updateForm,
    deleteForm,
    getFormPublic
};

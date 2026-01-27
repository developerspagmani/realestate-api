const { prisma } = require('../config/database');

// Get all workflows
const getAllWorkflows = async (req, res) => {
    try {
        const tenantId = req.tenant?.id;
        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'Tenant ID is required' });
        }

        const workflows = await prisma.marketingWorkflow.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({ success: true, data: workflows });
    } catch (error) {
        console.error('Get all workflows error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching workflows' });
    }
};

// Create workflow
const createWorkflow = async (req, res) => {
    try {
        const tenantId = req.tenant?.id;
        const { name, description, trigger, steps, status } = req.body;

        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'Tenant ID is required' });
        }

        const workflow = await prisma.marketingWorkflow.create({
            data: {
                name,
                description,
                trigger: trigger || {},
                steps: steps || {},
                status: status || 1,
                tenantId
            }
        });

        res.status(201).json({ success: true, message: 'Workflow created successfully', data: workflow });
    } catch (error) {
        console.error('Create workflow error:', error);
        res.status(500).json({ success: false, message: 'Server error creating workflow' });
    }
};

// Toggle workflow
const toggleWorkflow = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant?.id;

        const workflow = await prisma.marketingWorkflow.findFirst({
            where: { id, tenantId }
        });

        if (!workflow) {
            return res.status(404).json({ success: false, message: 'Workflow not found' });
        }

        const updatedWorkflow = await prisma.marketingWorkflow.update({
            where: { id },
            data: { status: workflow.status === 1 ? 2 : 1 }
        });

        res.status(200).json({ success: true, message: 'Workflow status updated', data: updatedWorkflow });
    } catch (error) {
        console.error('Toggle workflow error:', error);
        res.status(500).json({ success: false, message: 'Server error updating workflow' });
    }
};

// Update workflow
const updateWorkflow = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant?.id;
        const { name, description, trigger, steps, status } = req.body;

        const workflow = await prisma.marketingWorkflow.updateMany({
            where: { id, tenantId },
            data: {
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(trigger && { trigger }),
                ...(steps && { steps }),
                ...(status !== undefined && { status: parseInt(status) })
            }
        });

        res.status(200).json({ success: true, message: 'Workflow updated successfully', data: workflow });
    } catch (error) {
        console.error('Update workflow error:', error);
        res.status(500).json({ success: false, message: 'Server error updating workflow' });
    }
};

// Delete workflow
const deleteWorkflow = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant?.id;

        await prisma.marketingWorkflow.deleteMany({
            where: { id, tenantId }
        });

        res.status(200).json({ success: true, message: 'Workflow deleted successfully' });
    } catch (error) {
        console.error('Delete workflow error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting workflow' });
    }
};

module.exports = {
    getAllWorkflows,
    createWorkflow,
    updateWorkflow,
    toggleWorkflow,
    deleteWorkflow
};

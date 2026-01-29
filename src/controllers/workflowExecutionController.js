const WorkflowService = require('../services/marketing/WorkflowService');
const { prisma } = require('../config/database');

const runWorkflows = async (req, res) => {
    try {
        await WorkflowService.processWorkflows();
        res.status(200).json({ success: true, message: 'Workflows processed' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const enrollInWorkflow = async (req, res) => {
    try {
        const { workflowId, leadId } = req.body;
        const enrollment = await WorkflowService.enrollLead(workflowId, leadId);
        if (enrollment) {
            res.status(200).json({ success: true, data: enrollment });
        } else {
            res.status(400).json({ success: false, message: 'Enrollment failed' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getEnrollments = async (req, res) => {
    try {
        const { id } = req.params; // Workflow ID
        const enrollments = await prisma.workflowEnrollment.findMany({
            where: { workflowId: id },
            include: {
                lead: {
                    select: { id: true, name: true, email: true, leadScore: true }
                },
                logs: {
                    take: 5,
                    orderBy: { occurredAt: 'desc' }
                }
            }
        });
        res.status(200).json({ success: true, data: enrollments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    runWorkflows,
    enrollInWorkflow,
    getEnrollments
};

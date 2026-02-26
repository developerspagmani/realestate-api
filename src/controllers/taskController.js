const { prisma } = require('../config/database');
const emailService = require('../utils/emailService');


module.exports = {
    createTask: async (req, res) => {
        try {
            const { title, description, priority, dueDate, assignedTo, leadId } = req.body;
            const tenantId = req.user.tenantId;
            const createdBy = req.user.id;

            if (!assignedTo || assignedTo.trim() === '') {
                return res.status(400).json({ success: false, message: 'Agent assignment is required' });
            }

            const task = await prisma.task.create({
                data: {
                    title,
                    description,
                    priority: parseInt(priority) || 2,
                    dueDate: dueDate ? new Date(dueDate) : null,
                    assignedTo: assignedTo,
                    leadId: (leadId && leadId.trim() !== '') ? leadId : null,
                    tenantId,
                    createdBy,
                    status: 1 // Pending
                },
                include: {
                    agent: { include: { user: { select: { name: true, email: true } } } },
                    lead: { select: { name: true } }
                }
            });

            // Send Email Notification to Agent
            if (task.agent?.user?.email) {
                try {
                    await emailService.sendTaskAssignmentEmail(
                        task.agent.user.email,
                        task.agent.user.name,
                        {
                            title: task.title,
                            description: task.description,
                            priority: task.priority,
                            dueDate: task.dueDate,
                            leadName: task.lead?.name
                        }
                    );
                } catch (emailErr) {
                    console.error('[TaskController] Failed to send assignment email:', emailErr);
                }
            }

            res.status(201).json({ success: true, data: task });

        } catch (error) {
            console.error('Create task error details:', error);
            res.status(500).json({
                success: false,
                message: 'Server error creating task',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },


    getTenantTasks: async (req, res) => {
        try {
            const tenantId = req.user.tenantId;
            const { status, priority, assignedTo } = req.query;

            const where = { tenantId };
            if (status) where.status = parseInt(status);
            if (priority) where.priority = parseInt(priority);
            if (assignedTo) where.assignedTo = assignedTo;

            const tasks = await prisma.task.findMany({
                where,
                include: {
                    agent: { include: { user: { select: { name: true } } } },
                    lead: { select: { name: true } },
                    creator: { select: { name: true } }
                },
                orderBy: { createdAt: 'desc' }
            });

            res.status(200).json({ success: true, data: tasks });
        } catch (error) {
            console.error('Get tasks error:', error);
            res.status(500).json({ success: false, message: 'Server error fetching tasks' });
        }
    },

    getAgentTasks: async (req, res) => {
        try {
            const tenantId = req.user.tenantId;
            const userId = req.user.id;

            // Find agent profile for this user
            const agent = await prisma.agent.findUnique({ where: { userId } });
            if (!agent) {
                return res.status(404).json({ success: false, message: 'Agent profile not found' });
            }

            const tasks = await prisma.task.findMany({
                where: {
                    tenantId,
                    assignedTo: agent.id,
                    status: { in: [1, 2] } // Pending or In Progress
                },
                include: {
                    lead: { select: { name: true, phone: true, email: true } },
                    creator: { select: { name: true } }
                },
                orderBy: [
                    { priority: 'desc' },
                    { dueDate: 'asc' }
                ]
            });

            res.status(200).json({ success: true, data: tasks });
        } catch (error) {
            console.error('Get agent tasks error:', error);
            res.status(500).json({ success: false, message: 'Server error fetching tasks' });
        }
    },

    updateTaskStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const tenantId = req.user.tenantId;

            const task = await prisma.task.update({
                where: { id, tenantId },
                data: { status: parseInt(status) }
            });

            res.status(200).json({ success: true, data: task });
        } catch (error) {
            console.error('Update task status error:', error);
            res.status(500).json({ success: false, message: 'Server error updating task' });
        }
    },

    deleteTask: async (req, res) => {
        try {
            const { id } = req.params;
            const tenantId = req.user.tenantId;

            await prisma.task.delete({
                where: { id, tenantId }
            });

            res.status(200).json({ success: true, message: 'Task deleted' });
        } catch (error) {
            console.error('Delete task error:', error);
            res.status(500).json({ success: false, message: 'Server error deleting task' });
        }
    }
};

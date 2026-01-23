const { prisma } = require('../config/database');
const bcrypt = require('bcryptjs');

// Create Agent (User + Agent Profile)
const createAgent = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            phone,
            password,
            specialization,
            commissionRate
        } = req.body;

        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'Tenant ID is required' });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            // Check if user is already an agent
            const existingAgent = await prisma.agent.findFirst({ where: { userId: existingUser.id } });
            if (existingAgent) {
                return res.status(400).json({ success: false, message: 'User is already an agent' });
            }

            // If user exists but not agent, upgrade them (create agent profile for them)
            // But for now, let's keep it simple and just return error as per previous implementation logic request
            return res.status(400).json({ success: false, message: 'User with this email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Transaction to create User and Agent
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    passwordHash: hashedPassword,
                    firstName,
                    lastName,
                    name: `${firstName} ${lastName}`,
                    phone,
                    role: 2, // Using 2 (Admin) for now, or we can define 4. Let's use 2 but restrict via module? Or maybe just create a generic user role 1 with specific permissions? 
                    // Actually concept said Role 4. But schema comment says // 1: user, 2: admin, 3: owner.
                    // Let's stick to existing roles for now, maybe 1 (User) + Agent Profile makes them an agent?
                    // Or let's assume we use role 2 (Admin) but with limited permissions?
                    // Safe bet: Use Role 1 (User) and the existance of 'Agent' record defines them as Agent.
                    role: 1,
                    tenantId,
                    status: 1
                }
            });

            const agent = await tx.agent.create({
                data: {
                    tenantId,
                    userId: user.id,
                    specialization,
                    commissionRate: commissionRate || 2.5,
                    status: 1 // Active
                }
            });

            return { user, agent };
        });

        res.status(201).json({
            success: true,
            message: 'Agent created successfully',
            data: result
        });

    } catch (error) {
        console.error('Create agent error:', error);
        res.status(500).json({ success: false, message: 'Server error creating agent' });
    }
};

// Get All Agents
const getAllAgents = async (req, res) => {
    try {
        const { status, tenantId: queryTenantId } = req.query;
        let tenantId = req.user?.tenantId;

        // If admin, they can specify a tenantId to filter
        if (req.user?.role === 2 && queryTenantId) {
            tenantId = queryTenantId;
        }

        const where = {};
        if (tenantId) where.tenantId = tenantId;
        if (status) where.status = parseInt(status);

        const agents = await prisma.agent.findMany({
            where,
            select: {
                id: true,
                tenantId: true,
                userId: true,
                specialization: true,
                commissionRate: true,
                status: true,
                totalLeads: true,
                totalDeals: true,
                lastLeadAssignedAt: true,
                createdAt: true,
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                        name: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({
            success: true,
            data: { agents }
        });
    } catch (error) {
        console.error('Get agents error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching agents' });
    }
};

// Update Agent
const updateAgent = async (req, res) => {
    try {
        const { id } = req.params;
        const { specialization, commissionRate, status } = req.body;
        const tenantId = req.user?.tenantId;

        // Verify ownership
        const existing = await prisma.agent.findUnique({ where: { id } });
        if (!existing || existing.tenantId !== tenantId) {
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }

        const agent = await prisma.agent.update({
            where: { id },
            data: {
                specialization,
                commissionRate,
                status: status ? parseInt(status) : undefined
            }
        });

        res.status(200).json({
            success: true,
            message: 'Agent updated successfully',
            data: { agent }
        });

    } catch (error) {
        console.error('Update agent error:', error);
        res.status(500).json({ success: false, message: 'Error updating agent' });
    }
};

// Delete Agent
const deleteAgent = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;

        // Verify ownership
        const existing = await prisma.agent.findUnique({
            where: { id },
            include: { user: true }
        });

        if (!existing || existing.tenantId !== tenantId) {
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }

        // Delete agent profile and user account (cascades or separate delete)
        await prisma.$transaction([
            prisma.agent.delete({ where: { id } }),
            prisma.user.delete({ where: { id: existing.userId } })
        ]);

        res.status(200).json({
            success: true,
            message: 'Agent and associated user deleted successfully'
        });

    } catch (error) {
        console.error('Delete agent error:', error);
        res.status(500).json({ success: false, message: 'Error deleting agent' });
    }
};

// Get Agent Commissions
const getAgentCommissions = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;

        // Verify agent belongs to tenant
        const agent = await prisma.agent.findUnique({ where: { id } });
        if (!agent || agent.tenantId !== tenantId) {
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }

        const commissions = await prisma.commission.findMany({
            where: { agentId: id },
            orderBy: { createdAt: 'desc' },
            include: {
                booking: {
                    select: {
                        id: true,
                        startAt: true,
                        totalPrice: true,
                        unit: {
                            select: { unitCode: true }
                        }
                    }
                }
            }
        });

        res.status(200).json({
            success: true,
            data: { commissions }
        });

    } catch (error) {
        console.error('Get commissions error:', error);
        res.status(500).json({ success: false, message: 'Error fetching commissions' });
    }
};

// Helper: Round Robin Assignment
const assignLeadRoundRobin = async (tenantId, leadId) => {
    try {
        // 1. Find active agents for tenant, sorted by last assignment
        const agents = await prisma.agent.findMany({
            where: {
                tenantId,
                status: 1 // Active
            },
            orderBy: [
                { lastLeadAssignedAt: 'asc' }, // Nulls first usually, or oldest timestamp
                { createdAt: 'asc' }
            ]
        });

        if (agents.length === 0) return null;

        // 2. Select the first one
        const selectedAgent = agents[0];

        // 3. Assign lead and update agent stats
        await prisma.$transaction([
            prisma.lead.update({
                where: { id: leadId },
                data: {
                    agentId: selectedAgent.id,
                    assignedAt: new Date()
                }
            }),
            prisma.agent.update({
                where: { id: selectedAgent.id },
                data: {
                    lastLeadAssignedAt: new Date(),
                    totalLeads: { increment: 1 }
                }
            })
        ]);

        return selectedAgent;

    } catch (error) {
        console.error('Round Robin Assignment Error:', error);
        return null;
    }
};

module.exports = {
    createAgent,
    getAllAgents,
    updateAgent,
    deleteAgent,
    getAgentCommissions,
    assignLeadRoundRobin
};

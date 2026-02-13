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
            commissionRate,
            status,
            tenantId: bodyTenantId
        } = req.body;

        const tenantId = (req.user?.role === 2 && bodyTenantId) ? bodyTenantId : req.user?.tenantId;

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
                    role: 4, // Role 4: Agent
                    tenantId,
                    status: status || 1
                }
            });

            const agent = await tx.agent.create({
                data: {
                    tenantId,
                    userId: user.id,
                    specialization,
                    commissionRate: commissionRate || 2.5,
                    status: status || 1 // Active
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
        const { specialization, commissionRate, status, tenantId: bodyTenantId } = req.body;

        // If admin, they can update any agent. If owner, check ownership.
        const isAdmin = req.user?.role === 2;
        const userTenantId = req.user?.tenantId;

        const existing = await prisma.agent.findUnique({
            where: { id },
            include: { user: true }
        });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }

        if (!isAdmin && existing.tenantId !== userTenantId) {
            return res.status(403).json({ success: false, message: 'Unauthorized to update this agent' });
        }

        const agent = await prisma.$transaction(async (tx) => {
            // Update User fields if provided
            if (req.body.firstName || req.body.lastName || req.body.phone) {
                const updateData = {};
                if (req.body.firstName) updateData.firstName = req.body.firstName;
                if (req.body.lastName) updateData.lastName = req.body.lastName;
                if (req.body.phone) updateData.phone = req.body.phone;

                // Update full name if both parts or either are provided
                if (req.body.firstName || req.body.lastName) {
                    const fname = req.body.firstName || existing.user?.firstName;
                    const lname = req.body.lastName || existing.user?.lastName;
                    updateData.name = `${fname || ''} ${lname || ''}`.trim();
                }

                await tx.user.update({
                    where: { id: existing.userId },
                    data: updateData
                });
            }

            // Update Agent fields
            return await tx.agent.update({
                where: { id },
                data: {
                    specialization,
                    commissionRate,
                    status: status ? parseInt(status) : undefined
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                            phone: true,
                            name: true
                        }
                    }
                }
            });
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
        const isAdmin = req.user?.role === 2;
        const userTenantId = req.user?.tenantId;

        const existing = await prisma.agent.findUnique({
            where: { id },
            include: { user: true }
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }

        if (!isAdmin && existing.tenantId !== userTenantId) {
            return res.status(403).json({ success: false, message: 'Unauthorized to delete this agent' });
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
        const isAdmin = req.user?.role === 2;
        const userTenantId = req.user?.tenantId;

        // Verify agent exists and belongs to tenant (or admin)
        const agent = await prisma.agent.findUnique({ where: { id } });
        if (!agent) {
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }

        if (!isAdmin && agent.tenantId !== userTenantId) {
            return res.status(403).json({ success: false, message: 'Unauthorized to view these commissions' });
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
                { lastLeadAssignedAt: 'asc' }, // Nulls first usually
                { createdAt: 'asc' }
            ]
        });

        if (agents.length === 0) return null;

        // 2. Select the first one
        const selectedAgent = agents[0];

        // 3. Assign lead (VIA JUNCTION TABLE)
        await prisma.$transaction([
            prisma.agentLead.create({
                data: {
                    agentId: selectedAgent.id,
                    leadId: leadId,
                    isPrimary: true,
                    status: 1 // Active
                }
            }),
            prisma.lead.update({
                where: { id: leadId },
                data: { assignedAt: new Date() }
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

// --- Agent Dashboard Endpoints (Role 4) ---

const getMyLeads = async (req, res) => {
    try {
        const userId = req.user?.id;

        // Find agent profile for this user
        const agent = await prisma.agent.findUnique({
            where: { userId }
        });

        if (!agent) {
            return res.status(404).json({ success: false, message: 'Agent profile not found' });
        }

        // FETCH FROM JUNCTION TABLE
        const assignments = await prisma.agentLead.findMany({
            where: {
                agentId: agent.id,
                status: 1 // Only active assignments
            },
            include: {
                lead: {
                    include: {
                        property: { select: { title: true } },
                        unit: { select: { unitCode: true } }
                    }
                }
            },
            orderBy: { assignedAt: 'desc' }
        });

        // Flatten checks for compatibility if frontend expects direct lead usage
        const leads = assignments.map(a => ({
            ...a.lead,
            assignedAt: a.assignedAt, // Use assignment time
            isPrimary: a.isPrimary
        }));

        res.status(200).json({ success: true, data: { leads } });
    } catch (error) {
        console.error('Get my leads error:', error);
        res.status(500).json({ success: false, message: 'Error fetching leads' });
    }
};

const getMyCommissions = async (req, res) => {
    try {
        const userId = req.user?.id;

        const agent = await prisma.agent.findUnique({
            where: { userId }
        });

        if (!agent) {
            return res.status(404).json({ success: false, message: 'Agent profile not found' });
        }

        const commissions = await prisma.commission.findMany({
            where: { agentId: agent.id },
            orderBy: { createdAt: 'desc' },
            include: {
                booking: {
                    select: {
                        id: true,
                        startAt: true,
                        totalPrice: true,
                        unit: { select: { unitCode: true } }
                    }
                }
            }
        });

        res.status(200).json({ success: true, data: { commissions } });
    } catch (error) {
        console.error('Get my commissions error:', error);
        res.status(500).json({ success: false, message: 'Error fetching commissions' });
    }
};

const updateAgentLeadStatus = async (req, res) => {
    try {
        const { id } = req.params; // lead ID
        const { status, notes } = req.body;
        const userId = req.user?.id;

        const agent = await prisma.agent.findUnique({
            where: { userId }
        });

        if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });

        // Verify assignment exists via Junction Table
        const assignment = await prisma.agentLead.findFirst({
            where: {
                agentId: agent.id,
                leadId: id,
                status: 1
            }
        });

        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Lead assignment not found or inactive' });
        }

        const lead = await prisma.lead.findUnique({ where: { id } });

        const updatedLead = await prisma.lead.update({
            where: { id },
            data: {
                status: parseInt(status),
                notes: notes ? `${lead.notes || ''}\n[Update ${new Date().toISOString()}]: ${notes}` : lead.notes
            }
        });

        res.status(200).json({ success: true, message: 'Status updated', data: { lead: updatedLead } });
    } catch (error) {
        console.error('Update lead status error:', error);
        res.status(500).json({ success: false, message: 'Error updating lead status' });
    }
};

const getMyProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        const agent = await prisma.agent.findUnique({
            where: { userId },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true
                    }
                }
            }
        });

        res.status(200).json({ success: true, data: { agent } });
    } catch (error) {
        console.error('Get my profile error:', error);
        res.status(500).json({ success: false, message: 'Error fetching profile' });
    }
};

// Assign Property to Agent
const assignProperty = async (req, res) => {
    try {
        const isAdmin = req.user?.role === 2;
        const tenantId = isAdmin ? (req.body.tenantId || req.user.tenantId) : req.user.tenantId;

        // Ensure both exist and belong to the correct tenant
        const [agent, property] = await Promise.all([
            prisma.agent.findFirst({ where: { id: agentId, tenantId } }),
            prisma.property.findFirst({ where: { id: propertyId, tenantId } })
        ]);

        if (!agent || !property) {
            return res.status(404).json({ success: false, message: 'Agent or Property not found or access denied' });
        }

        // Check if already assigned
        const existing = await prisma.agentProperty.findFirst({
            where: { agentId, propertyId }
        });

        if (existing) {
            return res.status(400).json({ success: false, message: 'Property already assigned to this agent' });
        }

        const assignment = await prisma.agentProperty.create({
            data: {
                agentId,
                propertyId,
                commissionRate: commissionRate || agent.commissionRate,
                isPrimary: isPrimary || false,
                notes,
                status: 1 // Active
            }
        });

        res.status(201).json({ success: true, message: 'Property assigned to agent', data: assignment });
    } catch (error) {
        console.error('Assign property error:', error);
        res.status(500).json({ success: false, message: 'Error assigning property' });
    }
};

// Get Agent Assignments
const getAgentProperties = async (req, res) => {
    try {
        const { id } = req.params; // Agent ID
        const isAdmin = req.user?.role === 2;
        const tenantId = isAdmin ? (req.query.tenantId || req.user.tenantId) : req.user.tenantId;

        // Verify agent belongs to tenant
        const agent = await prisma.agent.findFirst({
            where: { id, tenantId }
        });

        if (!agent) {
            return res.status(404).json({ success: false, message: 'Agent not found or access denied' });
        }

        const assignments = await prisma.agentProperty.findMany({
            where: { agentId: id },
            include: {
                property: {
                    include: {
                        mainImage: true
                    }
                }
            }
        });
        res.status(200).json({ success: true, data: assignments });
    } catch (error) {
        console.error('Get agent properties error:', error);
        res.status(500).json({ success: false, message: 'Error fetching assignments' });
    }
};

// Unassign Property
const unassignProperty = async (req, res) => {
    try {
        const { id } = req.params; // Assignment ID
        const isAdmin = req.user?.role === 2;
        const tenantId = isAdmin ? (req.query.tenantId || req.user.tenantId) : req.user.tenantId;

        const assignment = await prisma.agentProperty.findFirst({
            where: { id },
            include: { agent: true }
        });

        if (!assignment || (!isAdmin && assignment.agent.tenantId !== tenantId)) {
            return res.status(404).json({ success: false, message: 'Assignment not found or access denied' });
        }

        await prisma.agentProperty.delete({
            where: { id }
        });
        res.status(200).json({ success: true, message: 'Property unassigned' });
    } catch (error) {
        console.error('Unassign property error:', error);
        res.status(500).json({ success: false, message: 'Error deleting assignment' });
    }
};

// --- Lead Assignment Methods ---

const assignLead = async (req, res) => {
    try {
        const { agentId, leadId, isPrimary, notes } = req.body;
        const isAdmin = req.user?.role === 2;
        const tenantId = isAdmin ? (req.body.tenantId || req.user.tenantId) : req.user.tenantId;

        const [agent, lead] = await Promise.all([
            prisma.agent.findFirst({ where: { id: agentId, tenantId } }),
            prisma.lead.findFirst({ where: { id: leadId, tenantId } })
        ]);

        if (!agent || !lead) return res.status(404).json({ success: false, message: 'Agent or Lead not found or access denied' });

        const existing = await prisma.agentLead.findFirst({
            where: { agentId, leadId }
        });

        if (existing) return res.status(400).json({ success: false, message: 'Lead already assigned to agent' });

        const assignment = await prisma.agentLead.create({
            data: {
                agentId,
                leadId,
                isPrimary: isPrimary ?? true,
                status: 1,
                notes
            }
        });

        // Update agent stats
        await prisma.agent.update({
            where: { id: agentId },
            data: { totalLeads: { increment: 1 }, lastLeadAssignedAt: new Date() }
        });

        // Update lead assignedAt so we know it's handled
        await prisma.lead.update({
            where: { id: leadId },
            data: { assignedAt: new Date() }
        });

        res.status(201).json({ success: true, message: 'Lead assigned', data: assignment });
    } catch (error) {
        console.error('Assign lead error:', error);
        res.status(500).json({ success: false, message: 'Error assigning lead' });
    }
};

const getAgentLeads = async (req, res) => {
    try {
        const { id } = req.params; // Agent ID
        const isAdmin = req.user?.role === 2;
        const tenantId = isAdmin ? (req.query.tenantId || req.user.tenantId) : req.user.tenantId;

        const agent = await prisma.agent.findFirst({
            where: { id, tenantId }
        });

        if (!agent) {
            return res.status(404).json({ success: false, message: 'Agent not found or access denied' });
        }

        const assignments = await prisma.agentLead.findMany({
            where: { agentId: id },
            include: {
                lead: {
                    include: {
                        property: { select: { title: true } }
                    }
                }
            }
        });
        res.status(200).json({ success: true, data: assignments });
    } catch (error) {
        console.error('Get agent leads error:', error);
        res.status(500).json({ success: false, message: 'Error fetching assignments' });
    }
};

const unassignLead = async (req, res) => {
    try {
        const { id } = req.params; // Assignment ID
        const isAdmin = req.user?.role === 2;
        const tenantId = isAdmin ? (req.query.tenantId || req.user.tenantId) : req.user.tenantId;

        const assignment = await prisma.agentLead.findFirst({
            where: { id },
            include: { agent: true }
        });

        if (!assignment || (!isAdmin && assignment.agent.tenantId !== tenantId)) {
            return res.status(404).json({ success: false, message: 'Assignment not found or access denied' });
        }

        await prisma.agentLead.delete({ where: { id } });
        res.status(200).json({ success: true, message: 'Lead unassigned' });
    } catch (error) {
        console.error('Unassign lead error:', error);
        res.status(500).json({ success: false, message: 'Error unassigning lead' });
    }
};

module.exports = {
    createAgent,
    getAllAgents,
    updateAgent,
    deleteAgent,
    getAgentCommissions,
    assignLeadRoundRobin,
    getMyLeads,
    getMyCommissions,
    updateAgentLeadStatus,
    getMyProfile,
    assignProperty,
    getAgentProperties,
    unassignProperty,
    assignLead,
    getAgentLeads,
    unassignLead
};

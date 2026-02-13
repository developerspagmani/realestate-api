const { prisma } = require('../config/database');
const { assignLeadRoundRobin } = require('./agentController');
const { sendLeadEmail } = require('../utils/emailService');

// Get all leads (Admin/Owner only)
const getAllLeads = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      source,
      priority,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      tenantId: queryTenantId,
      ownerId,
      industryType
    } = req.query;

    const isAdmin = req.user.role === 2;
    // SEC-01 fix: Force tenantId from user context for non-admins to prevent IDOR
    const tenantId = (isAdmin && queryTenantId) ? queryTenantId : (isAdmin ? (queryTenantId || null) : (req.tenant?.id || req.user?.tenantId));

    if (!tenantId && !isAdmin && !industryType) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID required'
      });
    }

    const pageInt = parseInt(page) || 1;
    const limitInt = parseInt(limit) || 10;
    const skip = (pageInt - 1) * limitInt;

    // Build where clause
    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (industryType) {
      where.tenant = { type: parseInt(industryType) };
    }

    // Owner logic
    const effectiveOwnerId = req.user.role === 2 ? ownerId : (req.user.role === 3 ? req.user.id : null);

    if (effectiveOwnerId) {
      // Check if user has any specific property access defined
      const hasAccessRecords = await prisma.userPropertyAccess.count({
        where: { userId: effectiveOwnerId, tenantId }
      });

      if (hasAccessRecords > 0) {
        const accessFilter = {
          userPropertyAccess: {
            some: { userId: effectiveOwnerId }
          }
        };
        where.OR = [
          { unit: { property: accessFilter } },
          { property: accessFilter },
          { AND: [{ propertyId: null }, { unitId: null }] } // General inquiries for the tenant
        ];
      }
      // If no access records found, we assume they are the Lead/Main owner 
      // and show all leads for the tenant (where.tenantId is already set)
    }
    console.log('Fetching leads for tenant:', tenantId, 'Query:', req.query);

    if (status && status !== 'all') {
      const statusMap = { 'new': 1, 'contacted': 2, 'qualified': 3, 'converted': 4, 'lost': 5 };
      where.status = statusMap[status.toLowerCase()] || parseInt(status);
    }

    if (source && source !== 'all') {
      const sourceMap = { 'website': 1, 'email': 2, 'phone': 3, 'social': 4, 'referral': 5, 'other': 6 };
      where.source = sourceMap[source.toLowerCase()] || parseInt(source);
    }

    if (priority && priority !== 'all') where.priority = parseInt(priority);

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        select: {
          id: true,
          tenantId: true,
          name: true,
          email: true,
          phone: true,
          company: true,
          message: true,
          source: true,
          priority: true,
          status: true,
          budget: true,
          leadScore: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          unit: {
            select: {
              id: true,
              unitCode: true,
              unitCategory: true,
              property: {
                select: {
                  id: true,
                  title: true,
                  city: true,
                }
              }
            }
          },
          interactions: {
            orderBy: { occurredAt: 'desc' },
            take: 5
          },
          agentLeads: {
            where: { status: 1 },
            include: {
              agent: {
                select: {
                  id: true,
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true
                    }
                  }
                }
              }
            },
            take: 1
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limitInt,
      }),
      prisma.lead.count({ where })
    ]);

    // Transform leads to include flat 'agent' object
    const transformedLeads = leads.map(lead => ({
      ...lead,
      agent: lead.agentLeads?.[0]?.agent || null,
      agentLeads: undefined
    }));

    res.status(200).json({
      success: true,
      data: {
        leads: transformedLeads,
        pagination: {
          page: pageInt,
          limit: limitInt,
          total,
          pages: Math.ceil(total / limitInt),
        }
      }
    });
  } catch (error) {
    console.error('FULL ERROR:', error);
    res.status(500).json({
      success: false,
      message: error.message || String(error),
      stack: error.stack
    });
  }
};

// Get lead by ID
const getLeadById = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId: queryTenantId } = req.query;

    const isAdmin = req.user.role === 2;
    // SEC-01 fix: Force tenantId from user context for non-admins to prevent IDOR
    const tenantId = (isAdmin && queryTenantId) ? queryTenantId : (req.tenant?.id || req.user?.tenantId);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    const lead = await prisma.lead.findUnique({
      where: { id, tenantId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            status: true,
          }
        },
        interactions: {
          orderBy: { occurredAt: 'desc' },
          take: 20
        },
        agentLeads: {
          where: { status: 1 },
          include: {
            agent: {
              include: { user: { select: { name: true, email: true, phone: true } } }
            }
          }
        },
        unit: {
          include: {
            property: {
              select: {
                id: true,
                title: true,
                city: true,
                addressLine1: true,
              }
            }
          }
        }
      }
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    // Flatten agent for backward compatibility
    const transformedLead = {
      ...lead,
      agent: lead.agentLeads?.[0]?.agent || null,
      agentLeads: undefined
    };

    res.status(200).json({
      success: true,
      data: { lead: transformedLead }
    });
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching lead'
    });
  }
};

// Create lead
const createLead = async (req, res) => {
  try {
    const {
      tenantId: bodyTenantId,
      name,
      email,
      phone,
      company,
      message,
      source,
      status,
      priority,
      unitId,
      budget,
      preferredDate,
      notes,
      agentId // manual assignment
    } = req.body;

    const isAdmin = req.user.role === 2;
    // SEC-01 fix: Force tenantId from user context for non-admins to prevent IDOR
    const tenantId = (isAdmin && bodyTenantId) ? bodyTenantId : (req.tenant?.id || req.user?.tenantId);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    // Validate unit exists
    if (unitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId, tenantId },
        include: { property: true }
      });

      if (!unit) {
        return res.status(400).json({
          success: false,
          message: 'Unit not found'
        });
      }
    }

    const lead = await prisma.lead.create({
      data: {
        tenantId,
        name,
        email,
        phone,
        company,
        message,
        source: parseInt(source) || 1,
        priority: parseInt(priority) || 2,
        unitId,
        budget: budget ? parseFloat(budget) : null,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        status: status ? parseInt(status) : 1, // 1 = NEW
        userId: req.user?.id || null,
        notes: notes || null,
        // agentId removed
      },
      include: {
        unit: {
          select: {
            id: true,
            unitCode: true,
            unitCategory: true,
          }
        }
      }
    });

    // Auto-assign to agent using Round Robin ONLY if not manually assigned
    // Handle Manually Assigned Agent
    if (agentId) {
      console.log(`Lead ${lead.id} manually assigned to Agent ${agentId} via junction table`);
      await prisma.agentLead.create({
        data: {
          agentId,
          leadId: lead.id,
          isPrimary: true,
          status: 1
        }
      });

      // Update agent stats for manual assignment
      await prisma.agent.update({
        where: { id: agentId },
        data: {
          totalLeads: { increment: 1 },
          lastLeadAssignedAt: new Date()
        }
      });
    } else {
      // Auto-assign to agent using Round Robin
      // Note: assignLeadRoundRobin now handles the AgentLead creation internally
      const assignedAgent = await assignLeadRoundRobin(tenantId, lead.id);
      if (assignedAgent) {
        console.log(`Lead ${lead.id} auto-assigned to Agent ${assignedAgent.id}`);
      }
    }

    // Send Notification if enabled in tenant settings
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = tenant?.settings || {};
      if (settings.notifications?.emailLeads) {
        // Find tenant owner or admin email
        const owner = await prisma.user.findFirst({
          where: { tenantId, role: 3 }, // role 3 = OWNER
          select: { email: true }
        });
        if (owner) {
          await sendLeadEmail(owner.email, lead.name, {
            email: lead.email,
            phone: lead.phone,
            message: lead.message
          });
        }
      }

      // Auto-enroll in matching marketing workflows
      const WorkflowService = require('../services/marketing/WorkflowService');
      const workflows = await prisma.marketingWorkflow.findMany({
        where: { tenantId, status: 1 }
      });

      for (const wf of workflows) {
        const trigger = typeof wf.trigger === 'string' ? JSON.parse(wf.trigger) : wf.trigger;
        if (trigger?.type === 'LEAD_CREATED') {
          await WorkflowService.enrollLead(wf.id, lead.id);
        }
      }
    } catch (emailError) {
      console.error('Error in lead creation extra processes:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Lead created successfully',
      data: { lead }
    });
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating lead'
    });
  }
};

// Update lead status
const updateLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, tenantId: bodyTenantId } = req.body;
    const { tenantId: queryTenantId } = req.query;

    const isAdmin = req.user.role === 2;
    // SEC-01 fix: Force tenantId from user context for non-admins to prevent IDOR
    const tenantId = (isAdmin && (bodyTenantId || queryTenantId)) ? (bodyTenantId || queryTenantId) : (req.tenant?.id || req.user?.tenantId);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    if (![1, 2, 3, 4, 5].includes(parseInt(status))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lead status'
      });
    }

    const lead = await prisma.lead.update({
      where: { id, tenantId },
      data: {
        status: parseInt(status),
        notes: notes || null,
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        unit: {
          select: {
            id: true,
            unitCode: true,
            unitCategory: true,
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Lead status updated successfully',
      data: { lead }
    });
  } catch (error) {
    console.error('Update lead status error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error updating lead'
    });
  }
};

// Delete lead
const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId: queryTenantId } = req.query;

    const isAdmin = req.user.role === 2;
    // SEC-01 fix: Force tenantId from user context for non-admins to prevent IDOR
    const tenantId = (isAdmin && queryTenantId) ? queryTenantId : (req.tenant?.id || req.user?.tenantId);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    await prisma.lead.delete({
      where: { id, tenantId }
    });

    res.status(200).json({
      success: true,
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    console.error('Delete lead error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error deleting lead'
    });
  }
};

// Get lead statistics
const getLeadStats = async (req, res) => {
  try {
    const { period = 'month', tenantId: queryTenantId, ownerId, industryType } = req.query;

    const isAdmin = req.user.role === 2;
    // SEC-01 fix: Force tenantId from user context for non-admins to prevent IDOR
    const tenantId = (isAdmin && queryTenantId) ? queryTenantId : (isAdmin ? (queryTenantId || null) : (req.tenant?.id || req.user?.tenantId));

    if (!tenantId && !isAdmin && !industryType) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID required'
      });
    }

    let dateFilter;
    const now = new Date();

    switch (period) {
      case 'day':
        dateFilter = {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate())
        };
        break;
      case 'week':
        dateFilter = {
          gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        };
        break;
      case 'month':
        dateFilter = {
          gte: new Date(now.getFullYear(), now.getMonth(), 1)
        };
        break;
      case 'year':
        dateFilter = {
          gte: new Date(now.getFullYear(), 0, 1)
        };
        break;
    }

    const where = {
      createdAt: dateFilter
    };

    if (tenantId) where.tenantId = tenantId;
    if (industryType) {
      where.tenant = { type: parseInt(industryType) };
    }

    // Owner logic
    const effectiveOwnerId = isAdmin ? ownerId : (req.user.role === 3 ? req.user.id : null);

    if (effectiveOwnerId) {
      const accessFilter = {
        userPropertyAccess: {
          some: { userId: effectiveOwnerId }
        }
      };
      where.OR = [
        { unit: { property: accessFilter } },
        { property: accessFilter }
      ];
    }

    const [
      totalLeads,
      newLeads,
      contactedLeads,
      qualifiedLeads,
      convertedLeads,
      lostLeads,
      leadsBySource,
      leadsByPriority
    ] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, status: 1 } }),
      prisma.lead.count({ where: { ...where, status: 2 } }),
      prisma.lead.count({ where: { ...where, status: 3 } }),
      prisma.lead.count({ where: { ...where, status: 4 } }),
      prisma.lead.count({ where: { ...where, status: 5 } }),
      prisma.lead.groupBy({
        by: ['source'],
        where,
        _count: { id: true }
      }),
      prisma.lead.groupBy({
        by: ['priority'],
        where,
        _count: { id: true }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalLeads,
        newLeads,
        contactedLeads,
        qualifiedLeads,
        convertedLeads,
        lostLeads,
        conversionRate: totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(2) : 0,
        leadsBySource,
        leadsByPriority,
        period
      }
    });
  } catch (error) {
    console.error('Get lead stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching lead statistics'
    });
  }
};

// Update lead
const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tenantId: bodyTenantId,
      name,
      email,
      phone,
      company,
      message,
      source,
      status,
      priority,
      unitId,
      budget,
      preferredDate,
      notes,
      agentId // Allow updating agent
    } = req.body;

    const isAdmin = req.user.role === 2;
    // SEC-01 fix: Force tenantId from user context for non-admins to prevent IDOR
    const tenantId = (isAdmin && bodyTenantId) ? bodyTenantId : (req.tenant?.id || req.user?.tenantId);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    const data = {
      name,
      email,
      phone,
      company,
      message,
      budget: budget ? parseFloat(budget) : undefined,
      preferredDate: preferredDate ? new Date(preferredDate) : undefined,
      notes,
      updatedAt: new Date()
    };

    if (source) data.source = parseInt(source);
    if (status) data.status = parseInt(status);
    if (priority) data.priority = parseInt(priority);
    if (unitId) data.unitId = unitId;

    // Handle Agent Reassignment
    // Handle Agent Reassignment (Replace existing active assignments)
    if (agentId !== undefined) {
      if (agentId) {
        // Deactivate existing active assignments
        await prisma.agentLead.updateMany({
          where: { leadId: id, status: 1 },
          data: { status: 2 } // Inactive/Replaced
        });

        // Create new assignment
        await prisma.agentLead.create({
          data: {
            agentId,
            leadId: id,
            isPrimary: true,
            status: 1
          }
        });
      } else {
        // If explicitly null, just deactivate all (unassign)
        await prisma.agentLead.updateMany({
          where: { leadId: id, status: 1 },
          data: { status: 2 }
        });
      }
    }

    // Validate unit exists if unitId is provided
    if (unitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId, tenantId },
        include: { property: true }
      });

      if (!unit) {
        return res.status(400).json({
          success: false,
          message: 'Unit not found'
        });
      }
    }

    const lead = await prisma.lead.update({
      where: { id, tenantId },
      data,
      include: {
        unit: {
          select: {
            id: true,
            unitCode: true,
            unitCategory: true,
          }
        },
        agentLeads: {
          where: { status: 1 },
          include: {
            agent: {
              select: {
                id: true,
                user: { select: { name: true } }
              }
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Lead updated successfully',
      data: { lead }
    });
  } catch (error) {
    console.error('Update lead error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error updating lead'
    });
  }
};

module.exports = {
  getAllLeads,
  getLeadById,
  createLead,
  updateLead,
  updateLeadStatus,
  deleteLead,
  getLeadStats,
};

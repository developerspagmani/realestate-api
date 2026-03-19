const { prisma } = require('../config/database');

// Interaction scoring rules
const SCORING_RULES = {
    'EMAIL_OPEN': 1,
    'EMAIL_CLICK': 3,
    'PROPERTY_VIEW': 5,
    'UNIT_VIEW': 5,
    'FORM_SUBMIT': 20,
    'CHAT_INIT': 10,
    'CHAT_CHOICE': 5,
    'BOOKING_REQUEST': 30,
    'UNIT_BOOKING_START': 5,
    'WEBSITE_INQUIRY': 20,
    'POPUP_VIEW': 2,
    'POPUP_CLICK': 10,
    'POPUP_SUBMIT': 30
};

/**
 * Track a lead interaction and update score
 */
const trackInteraction = async (req, res) => {
    try {
        let { leadId, email, visitorId, type, metadata } = req.body;
        let tenantId = req.tenant?.id || metadata?.tenantId;
        const widgetId = metadata?.widgetId;

        if (!type || (!leadId && !email && !visitorId)) {
            return res.status(400).json({ success: false, message: 'Type and Lead identifier (ID, email, or visitorId) required' });
        }

        // If we don't have a direct tenant context but have a widget context, resolve it
        if (!tenantId && widgetId) {
            const widget = await prisma.widget.findFirst({
                where: { uniqueId: widgetId },
                select: { tenantId: true }
            });
            if (widget) tenantId = widget.tenantId;
        }

        // UUID validation helper
        const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

        // Find the lead with Identity Resolution
        let lead;
        if (leadId && isUuid(leadId)) {
            lead = await prisma.lead.findUnique({ where: { id: leadId } });
        } else if (email && tenantId && isUuid(tenantId)) {
            lead = await prisma.lead.findFirst({
                where: { email, tenantId },
                orderBy: { createdAt: 'desc' }
            });
        } else if (visitorId && tenantId && isUuid(tenantId)) {
            lead = await prisma.lead.findFirst({
                where: { visitorId, tenantId },
                orderBy: { createdAt: 'desc' }
            });
        }

        // If lead not found and we have visitorId + tenantId, create an anonymous lead
        if (!lead && visitorId && tenantId && isUuid(tenantId)) {
            lead = await prisma.lead.create({
                data: {
                    visitorId,
                    tenantId,
                    name: 'Anonymous Visitor',
                    status: 1, // Active
                    source: 5 // Widget/Public
                }
            });
        }

        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found and cannot be identified/created in current context' });
        }

        const scoreWeight = SCORING_RULES[type] || 0;

        // Start transaction to log interaction and update lead score
        const result = await prisma.$transaction(async (tx) => {
            const interaction = await tx.leadInteraction.create({
                data: {
                    tenantId: lead.tenantId,
                    leadId: lead.id,
                    type,
                    metadata: metadata || {},
                    scoreWeight
                }
            });

            const updatedLead = await tx.lead.update({
                where: { id: lead.id },
                data: {
                    leadScore: { increment: scoreWeight },
                    updatedAt: new Date()
                }
            });

            return { interaction, leadScore: updatedLead.leadScore };
        });

        res.status(200).json({
            success: true,
            message: `Interaction ${type} tracked successfully`,
            data: result
        });

    } catch (error) {
        console.error('Track interaction error:', error);
        res.status(500).json({ success: false, message: 'Server error tracking interaction' });
    }
};

/**
 * Get lead interactions
 */
const getLeadInteractions = async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user.role === 2;
        const tenantId = (isAdmin && req.query.tenantId) ? req.query.tenantId : (req.tenant?.id || req.user?.tenantId);

        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'Tenant context required' });
        }

        const interactions = await prisma.leadInteraction.findMany({
            where: {
                leadId: id,
                tenantId
            },
            orderBy: { occurredAt: 'desc' },
            take: 50
        });

        res.status(200).json({ success: true, data: interactions });
    } catch (error) {
        console.error('Get interactions error:', error);
        res.status(500).json({ success: false, message: 'Error fetching interactions' });
    }
};

module.exports = {
    trackInteraction,
    getLeadInteractions
};

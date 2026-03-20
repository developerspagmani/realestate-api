const { prisma } = require('../config/database');

// Interaction scoring rules
const SCORING_RULES = {
    'EMAIL_OPEN': 1,
    'EMAIL_CLICK': 5,
    'WIDGET_VIEW': 1,
    'PROPERTY_VIEW': 2,
    'UNIT_VIEW': 2,
    'FORM_INIT': 10,
    'FORM_SUBMIT': 35,
    'CHAT_INIT': 5,
    'CHAT_START_CONVERSATION': 20,
    'CHAT_CHOICE': 5,
    'BOOKING_STEP_START': 15,
    'BOOKING_REQUEST': 50,
    'UNIT_BOOKING_START': 5,
    'WEBSITE_INQUIRY': 30,
    'POPUP_VIEW': 1,
    'POPUP_CLICK': 10,
    'POPUP_SUBMIT': 40,
    'BROCHURE_DOWNLOAD': 20,
    'FLOOR_PLAN_VIEW': 10
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

        // If lead not found, we discard the interaction to keep CRM clean (per user request)
        if (!lead) {
            return res.status(200).json({ 
                success: true, 
                message: 'Interaction skipped: No lead found and anonymous creation is disabled to prevent CRM clutter.' 
            });
        }

        let scoreWeight = SCORING_RULES[type] || 0;
        
        // Behavioral Logic: Diminishing returns for repeated passive views
        if (['PROPERTY_VIEW', 'UNIT_VIEW', 'WIDGET_VIEW', 'POPUP_VIEW'].includes(type)) {
            const windowStart = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12h window
            
            // Look for any similar interaction in that window
            const previousInteraction = await prisma.leadInteraction.findFirst({
                where: {
                    leadId: lead.id,
                    type,
                    occurredAt: { gte: windowStart }
                },
                select: { id: true, metadata: true }
            });

            if (previousInteraction) {
                // If it's the exact same property, award almost 0 (10%)
                const isSameProperty = metadata?.propertyId && previousInteraction.metadata?.propertyId === metadata.propertyId;
                scoreWeight = isSameProperty ? 0 : Math.ceil(scoreWeight * 0.5); 
            }
        }

        // Behavioral Logic: Multi-stage Intent (e.g. starting a form is good, but doing it 5 times today is spam)
        if (['FORM_INIT', 'BOOKING_STEP_START', 'CHAT_INIT', 'BROCHURE_DOWNLOAD'].includes(type)) {
             const recentlyDone = await prisma.leadInteraction.findFirst({
                where: {
                    leadId: lead.id,
                    type,
                    occurredAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) } // 4h window
                },
                select: { id: true }
            });
            if (recentlyDone) scoreWeight = Math.ceil(scoreWeight * 0.1); // Drastic reduction for redundancy
        }

        // High Probability: Only award full points for FORM_SUBMIT once per 24h per lead
        if (type === 'FORM_SUBMIT') {
            const alreadySubmitted = await prisma.leadInteraction.findFirst({
                where: { leadId: lead.id, type: 'FORM_SUBMIT', occurredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
            });
            if (alreadySubmitted) scoreWeight = 5; // Maintenance points only
        }

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

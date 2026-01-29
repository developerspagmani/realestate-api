const { prisma } = require('../config/database');

// Interaction scoring rules
const SCORING_RULES = {
    'EMAIL_OPEN': 1,
    'EMAIL_CLICK': 3,
    'PROPERTY_VIEW': 5,
    'FORM_SUBMIT': 20,
    'CHAT_INIT': 10
};

/**
 * Track a lead interaction and update score
 */
const trackInteraction = async (req, res) => {
    try {
        const { leadId, email, type, metadata } = req.body;
        const tenantId = req.tenant?.id;

        if (!type || (!leadId && !email)) {
            return res.status(400).json({ success: false, message: 'Type and Lead identifier required' });
        }

        // Find the lead
        let lead;
        if (leadId) {
            lead = await prisma.lead.findUnique({ where: { id: leadId } });
        } else {
            // Find by email if leadId not provided (useful for tracking emails)
            lead = await prisma.lead.findFirst({
                where: { email, tenantId },
                orderBy: { createdAt: 'desc' }
            });
        }

        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }

        const scoreWeight = SCORING_RULES[type] || 0;

        // Start transaction to log interaction and update lead score
        const result = await prisma.$transaction(async (tx) => {
            const interaction = await tx.leadInteraction.create({
                data: {
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
        const interactions = await prisma.leadInteraction.findMany({
            where: { leadId: id },
            orderBy: { occurredAt: 'desc' },
            take: 50
        });

        res.status(200).json({ success: true, data: interactions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching interactions' });
    }
};

module.exports = {
    trackInteraction,
    getLeadInteractions
};

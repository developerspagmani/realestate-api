const PropertyMatchService = require('../services/marketing/PropertyMatchService');
const { sendPropertyRecommendationEmail } = require('../utils/emailService');
const { prisma } = require('../config/database');

const getLeadRecommendations = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant?.id;

        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'Tenant ID is required' });
        }

        // First trigger an update to ensure we have latest interpreted preferences
        await PropertyMatchService.updateLeadPreferences(id);

        const recommendations = await PropertyMatchService.getRecommendations(id, tenantId);

        res.status(200).json({
            success: true,
            data: recommendations
        });
    } catch (error) {
        console.error('Recommendations error:', error);
        res.status(500).json({ success: false, message: 'Error fetching recommendations' });
    }
};

const sendRecommendationEmailDirectly = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant?.id;

        const lead = await prisma.lead.findUnique({
            where: { id }
        });

        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }

        // Get the top matches
        const recommendations = await PropertyMatchService.getRecommendations(id, tenantId, 3);

        if (recommendations.length === 0) {
            return res.status(400).json({ success: false, message: 'No recommendations found for this lead' });
        }

        const emailSent = await sendPropertyRecommendationEmail(lead.email, lead.name, recommendations);

        if (emailSent) {
            // Track this as an interaction
            await prisma.leadInteraction.create({
                data: {
                    leadId: id,
                    type: 'EMAIL_SENT',
                    scoreWeight: 0,
                    metadata: { type: 'recommendation', propertyCount: recommendations.length }
                }
            });

            return res.status(200).json({ success: true, message: 'Recommendation email sent successfully' });
        } else {
            return res.status(500).json({ success: false, message: 'Failed to send email' });
        }
    } catch (error) {
        console.error('Send recommendation email error:', error);
        res.status(500).json({ success: false, message: 'Server error sending recommendation' });
    }
};

module.exports = {
    getLeadRecommendations,
    sendRecommendationEmailDirectly
};

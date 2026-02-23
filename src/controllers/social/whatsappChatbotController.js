const { prisma } = require('../../config/database');

/**
 * Get the chatbot configuration for a tenant
 */
const getBotConfig = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.user?.tenantId;

        let config = await prisma.whatsAppChatbot.findUnique({
            where: { tenantId }
        });

        if (!config) {
            // Create default config if not exists
            config = await prisma.whatsAppChatbot.create({
                data: {
                    tenantId,
                    isActive: true,
                    steps: [
                        {
                            id: 'welcome',
                            type: 'question',
                            content: 'Welcome to our real estate agency! How can we help you today?',
                            buttons: [
                                { label: 'Search Property', nextStepId: 'ask_location', valueToSave: null, fieldToSave: null },
                                { label: 'Talk to Agent', nextStepId: 'talk_agent', valueToSave: null, fieldToSave: null }
                            ]
                        },
                        {
                            id: 'ask_location',
                            type: 'question',
                            content: 'Which location are you interested in?',
                            buttons: [
                                { label: 'Bangalore', nextStepId: 'ask_budget', valueToSave: 'Bangalore', fieldToSave: 'location' },
                                { label: 'Hyderabad', nextStepId: 'ask_budget', valueToSave: 'Hyderabad', fieldToSave: 'location' },
                                { label: 'Mumbai', nextStepId: 'ask_budget', valueToSave: 'Mumbai', fieldToSave: 'location' }
                            ]
                        },
                        {
                            id: 'ask_budget',
                            type: 'question',
                            content: 'What is your budget range?',
                            buttons: [
                                { label: 'Under 50L', nextStepId: 'show_results', valueToSave: 5000000, fieldToSave: 'maxPrice' },
                                { label: '50L - 1Cr', nextStepId: 'show_results', valueToSave: 10000000, fieldToSave: 'maxPrice' },
                                { label: 'Above 1Cr', nextStepId: 'show_results', valueToSave: 20000000, fieldToSave: 'maxPrice' }
                            ]
                        },
                        {
                            id: 'talk_agent',
                            type: 'message',
                            content: 'Sure! One of our agents will contact you shortly.',
                            buttons: []
                        },
                        {
                            id: 'show_results',
                            type: 'action',
                            content: 'Let me find the best properties for you...',
                            actionType: 'SEARCH_PROPERTIES'
                        }
                    ],
                    startStepId: 'welcome'
                }
            });
        }

        res.status(200).json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('Get bot config error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching bot configuration'
        });
    }
};

/**
 * Update the chatbot configuration
 */
const updateBotConfig = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const { isActive, steps, startStepId } = req.body;

        const config = await prisma.whatsAppChatbot.upsert({
            where: { tenantId },
            update: {
                isActive,
                steps,
                startStepId,
                updatedAt: new Date()
            },
            create: {
                tenantId,
                isActive,
                steps,
                startStepId
            }
        });

        res.status(200).json({
            success: true,
            message: 'Bot configuration updated successfully',
            data: config
        });
    } catch (error) {
        console.error('Update bot config error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating bot configuration'
        });
    }
};

module.exports = {
    getBotConfig,
    updateBotConfig
};

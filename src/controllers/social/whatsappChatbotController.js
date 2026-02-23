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
                            id: 'main_menu',
                            type: 'question',
                            content: 'Welcome! How can we help you today?',
                            buttons: [
                                { id: 'btn_menu_props', label: 'Show Properties', nextStepId: 'ask_location', valueToSave: null, fieldToSave: null },
                                { id: 'btn_menu_agent', label: 'Talk to Agent', nextStepId: 'talk_agent', valueToSave: null, fieldToSave: null },
                                { id: 'btn_menu_booking', label: 'Booking Info', nextStepId: 'booking_info', valueToSave: null, fieldToSave: null }
                            ]
                        },
                        {
                            id: 'ask_location',
                            type: 'question',
                            content: 'Which location are you interested in?',
                            buttons: [
                                { id: 'btn_loc_bangalore', label: 'Bangalore', nextStepId: 'ask_budget', valueToSave: 'Bangalore', fieldToSave: 'location' },
                                { id: 'btn_loc_hyderabad', label: 'Hyderabad', nextStepId: 'ask_budget', valueToSave: 'Hyderabad', fieldToSave: 'location' },
                                { id: 'btn_loc_mumbai', label: 'Mumbai', nextStepId: 'ask_budget', valueToSave: 'Mumbai', fieldToSave: 'location' }
                            ]
                        },
                        {
                            id: 'ask_budget',
                            type: 'question',
                            content: 'What is your budget range?',
                            buttons: [
                                { id: 'btn_budget_50l', label: 'Under 50L', nextStepId: 'show_results', valueToSave: 5000000, fieldToSave: 'maxPrice' },
                                { id: 'btn_budget_1cr', label: '50L - 1Cr', nextStepId: 'show_results', valueToSave: 10000000, fieldToSave: 'maxPrice' },
                                { id: 'btn_budget_above', label: 'Above 1Cr', nextStepId: 'show_results', valueToSave: 20000000, fieldToSave: 'maxPrice' }
                            ]
                        },
                        {
                            id: 'show_results',
                            type: 'action',
                            content: 'Finding properties...',
                            actionType: 'SEARCH_PROPERTIES'
                        },
                        {
                            id: 'talk_agent',
                            type: 'message',
                            content: 'Sure! One of our agents will contact you shortly.',
                            buttons: [
                                { id: 'btn_back_menu', label: 'Back to Menu', nextStepId: 'main_menu', valueToSave: null, fieldToSave: null }
                            ]
                        },
                        {
                            id: 'booking_info',
                            type: 'message',
                            content: 'You can book property visits or reserve a unit directly through this chat. Just find a property and click "Book Visit"!',
                            buttons: [
                                { id: 'btn_book_start', label: 'Search Property', nextStepId: 'ask_location', valueToSave: null, fieldToSave: null },
                                { id: 'btn_book_menu', label: 'Back to Menu', nextStepId: 'main_menu', valueToSave: null, fieldToSave: null }
                            ]
                        },
                        {
                            id: 'ask_booking_date',
                            type: 'question',
                            content: 'When would you like to visit? Please choose a day:',
                            buttons: [
                                { id: 'btn_date_today', label: 'Today', nextStepId: 'check_availability', valueToSave: 'TODAY', fieldToSave: 'lastBookingDate' },
                                { id: 'btn_date_tomorrow', label: 'Tomorrow', nextStepId: 'check_availability', valueToSave: 'TOMORROW', fieldToSave: 'lastBookingDate' },
                                { id: 'btn_date_weekend', label: 'This Weekend', nextStepId: 'check_availability', valueToSave: 'WEEKEND', fieldToSave: 'lastBookingDate' }
                            ]
                        },
                        {
                            id: 'check_availability',
                            type: 'action',
                            content: 'Checking availability...',
                            actionType: 'CHECK_AVAILABILITY'
                        },
                        {
                            id: 'confirm_booking',
                            type: 'action',
                            content: 'Confirming your booking...',
                            actionType: 'CREATE_BOOKING'
                        }
                    ],
                    startStepId: 'main_menu'
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

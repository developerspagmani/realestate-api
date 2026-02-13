const Joi = require('joi');

module.exports = {
    // Seats/Workspace schemas
    createWorkspace: Joi.object({
        name: Joi.string().min(2).max(100).required(),
        description: Joi.string().max(500).optional(),
        type: Joi.string().valid('DESK', 'OFFICE', 'MEETING_ROOM', 'EVENT_SPACE').required(),
        capacity: Joi.number().integer().min(1).required(),
        area: Joi.number().positive().optional(),
        hourlyRate: Joi.number().positive().required(),
        dailyRate: Joi.number().positive().required(),
        monthlyRate: Joi.number().positive().required(),
        features: Joi.array().items(Joi.string()).optional(),
        spaceId: Joi.string().required(),
    }),

    updateWorkspace: Joi.object({
        name: Joi.string().min(2).max(100).optional(),
        description: Joi.string().max(500).optional(),
        type: Joi.string().valid('DESK', 'OFFICE', 'MEETING_ROOM', 'EVENT_SPACE').optional(),
        capacity: Joi.number().integer().min(1).optional(),
        area: Joi.number().positive().optional(),
        hourlyRate: Joi.number().positive().optional(),
        dailyRate: Joi.number().positive().optional(),
        monthlyRate: Joi.number().positive().optional(),
        features: Joi.array().items(Joi.string()).optional(),
        isAvailable: Joi.boolean().optional(),
    }),

    // Space schemas
    createSpace: Joi.object({
        name: Joi.string().min(2).max(100).required(),
        description: Joi.string().max(1000).optional(),
        address: Joi.string().required(),
        city: Joi.string().required(),
        state: Joi.string().required(),
        zipCode: Joi.string().optional(),
        country: Joi.string().required(),
        latitude: Joi.number().min(-90).max(90).optional(),
        longitude: Joi.number().min(-180).max(180).optional(),
        phone: Joi.string().pattern(/^[+]?[\d\s-()]+$/).optional(),
        email: Joi.string().email().optional(),
        website: Joi.string().uri().optional(),
    }),

    updateSpace: Joi.object({
        name: Joi.string().min(2).max(100).optional(),
        description: Joi.string().max(1000).optional(),
        address: Joi.string().optional(),
        city: Joi.string().optional(),
        state: Joi.string().optional(),
        zipCode: Joi.string().optional(),
        country: Joi.string().optional(),
        latitude: Joi.number().min(-90).max(90).optional(),
        longitude: Joi.number().min(-180).max(180).optional(),
        phone: Joi.string().pattern(/^[+]?[\d\s-()]+$/).optional(),
        email: Joi.string().email().optional(),
        website: Joi.string().uri().optional(),
        isActive: Joi.boolean().optional(),
    }),
};

const Joi = require('joi');

module.exports = {
    createLead: Joi.object({
        tenantId: Joi.string().uuid().required(),
        name: Joi.string().min(2).max(100).required(),
        email: Joi.string().email().required(),
        phone: Joi.string().min(5).max(20).optional().allow('', null),
        company: Joi.string().max(100).optional().allow('', null),
        message: Joi.string().max(1000).optional().allow('', null),
        source: Joi.alternatives().try(
            Joi.number().integer().valid(1, 2, 3, 4, 5, 6, 7),
            Joi.string().valid('website', 'phone', 'email', 'referral', 'social', 'other', 'chatbot')
        ).default(1),
        status: Joi.number().integer().valid(1, 2, 3, 4, 5).optional().default(1),
        priority: Joi.number().integer().valid(1, 2, 3).optional().default(2),
        unitId: Joi.string().uuid().optional().allow('', null),
        propertyId: Joi.string().uuid().optional().allow('', null),
        budget: Joi.number().min(0).optional().allow(null),
        preferredDate: Joi.date().optional().allow(null),
        notes: Joi.string().max(1000).optional().allow('', null),
        agentId: Joi.string().uuid().optional().allow('', null),
    }),

    updateLead: Joi.object({
        tenantId: Joi.string().uuid().optional(),
        name: Joi.string().min(2).max(100).optional(),
        email: Joi.string().email().optional(),
        phone: Joi.string().min(5).max(20).optional().allow('', null),
        company: Joi.string().max(100).optional().allow('', null),
        message: Joi.string().max(1000).optional().allow('', null),
        source: Joi.alternatives().try(
            Joi.number().integer().valid(1, 2, 3, 4, 5, 6, 7),
            Joi.string().valid('website', 'phone', 'email', 'referral', 'social', 'other', 'chatbot')
        ).optional(),
        status: Joi.number().integer().valid(1, 2, 3, 4, 5).optional(),
        priority: Joi.number().integer().valid(1, 2, 3).optional(),
        unitId: Joi.string().uuid().optional().allow('', null),
        propertyId: Joi.string().uuid().optional().allow('', null),
        budget: Joi.number().min(0).optional().allow(null),
        preferredDate: Joi.date().optional().allow(null),
        notes: Joi.string().max(1000).optional().allow('', null),
        agentId: Joi.string().uuid().optional().allow('', null),
    }),

    assignLead: Joi.object({
        agentId: Joi.string().uuid().required(),
        leadId: Joi.string().uuid().required(),
        isPrimary: Joi.boolean().optional(),
        status: Joi.number().integer().valid(1, 2).optional(),
        notes: Joi.string().max(1000).optional().allow('', null),
    }),

    updateLeadStatus: Joi.object({
        tenantId: Joi.string().uuid().required(),
        status: Joi.number().integer().valid(1, 2, 3, 4, 5).required(),
        notes: Joi.string().max(1000).optional(),
    }),
};

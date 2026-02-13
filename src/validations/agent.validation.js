const Joi = require('joi');

module.exports = {
    createAgent: Joi.object({
        tenantId: Joi.string().uuid().optional(),
        firstName: Joi.string().min(2).max(100).required(),
        lastName: Joi.string().min(2).max(100).required(),
        email: Joi.string().email().required(),
        phone: Joi.string().pattern(/^[+]?[\d\s-()]+$/).required(),
        password: Joi.string().min(6).required(),
        specialization: Joi.string().max(200).optional().allow('', null),
        commissionRate: Joi.number().min(0).max(100).default(2.5),
        status: Joi.number().integer().valid(1, 2, 3).default(1),
    }).unknown(true),

    updateAgent: Joi.object({
        tenantId: Joi.string().uuid().optional(),
        firstName: Joi.string().min(2).max(100).optional(),
        lastName: Joi.string().min(2).max(100).optional(),
        phone: Joi.string().pattern(/^[+]?[\d\s-()]+$/).optional().allow('', null),
        specialization: Joi.string().max(200).optional().allow('', null),
        commissionRate: Joi.number().min(0).max(100).optional(),
        status: Joi.number().integer().valid(1, 2, 3).optional(),
    }),

    updateAgentLeadStatus: Joi.object({
        status: Joi.number().integer().valid(1, 2, 3, 4, 5).required(),
        notes: Joi.string().max(1000).optional().allow('', null),
    }),
};

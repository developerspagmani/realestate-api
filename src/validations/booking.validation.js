const Joi = require('joi');

module.exports = {
    createBooking: Joi.object({
        tenantId: Joi.string().uuid().optional().allow('', null),
        userId: Joi.string().uuid().optional().allow('', null),
        unitId: Joi.string().uuid().required(),
        propertyId: Joi.string().uuid().optional().allow('', null),
        startAt: Joi.date().iso().required(),
        endAt: Joi.date().iso().greater(Joi.ref('startAt')).required(),
        status: Joi.number().integer().valid(1, 2, 3, 4, 5).optional(),
        paymentStatus: Joi.number().integer().valid(1, 2, 3).optional(),
        totalPrice: Joi.number().optional(),
        qrCode: Joi.string().optional().allow('', null),
        notes: Joi.string().max(1000).optional().allow(''),
        specialRequests: Joi.string().max(500).optional().allow(''),
        agentId: Joi.string().uuid().optional().allow('', null),
        guestName: Joi.string().max(100).optional().allow('', null),
        guestEmail: Joi.string().email().optional().allow('', null),
        guestPhone: Joi.string().max(20).optional().allow('', null),
        customerInfo: Joi.object({
            name: Joi.string().optional(),
            email: Joi.string().email().optional(),
            phone: Joi.string().optional(),
            address: Joi.string().optional()
        }).optional()
    }),

    updateBooking: Joi.object({
        userId: Joi.string().uuid().optional().allow('', null),
        unitId: Joi.string().uuid().optional().allow('', null),
        propertyId: Joi.string().uuid().optional().allow('', null),
        startAt: Joi.date().iso().optional(),
        endAt: Joi.date().iso().optional(),
        status: Joi.number().integer().valid(1, 2, 3, 4, 5).optional(),
        paymentStatus: Joi.number().integer().valid(1, 2, 3).optional(),
        notes: Joi.string().max(1000).optional().allow(''),
        specialRequests: Joi.string().max(500).optional().allow(''),
        tenantId: Joi.string().uuid().optional().allow('', null),
        agentId: Joi.string().uuid().optional().allow('', null),
        guestName: Joi.string().max(100).optional().allow('', null),
        guestEmail: Joi.string().email().optional().allow('', null),
        guestPhone: Joi.string().max(20).optional().allow('', null),
    }).custom((value, helpers) => {
        if (value.startAt && value.endAt) {
            if (new Date(value.endAt) <= new Date(value.startAt)) {
                return helpers.error('custom.dateOrder');
            }
        }
        return value;
    }).messages({
        'custom.dateOrder': 'endAt must be after startAt'
    }),
};

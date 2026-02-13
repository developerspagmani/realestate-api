const Joi = require('joi');

module.exports = {
    createUnit: Joi.object({
        tenantId: Joi.string().uuid().required(),
        propertyId: Joi.string().uuid().required(),
        unitCategory: Joi.number().integer().valid(1, 2, 3, 4).required(),
        unitCode: Joi.string().min(1).max(50).optional().allow('', null),
        slug: Joi.string().min(2).max(100).optional().allow('', null),
        floorNo: Joi.number().integer().min(0).optional().allow(null),
        capacity: Joi.number().integer().min(0).optional().allow(null),
        sizeSqft: Joi.number().integer().min(0).optional().allow(null),
        status: Joi.number().integer().valid(1, 2, 3, 4).default(1),
        mainImageId: Joi.string().uuid().optional().allow('', null),
        gallery: Joi.array().items(Joi.string().uuid()).optional().allow(null),
        hourlyRate: Joi.number().optional(),
        dailyRate: Joi.number().optional(),
        monthlyRate: Joi.number().optional(),
        currency: Joi.string().optional(),
        price: Joi.number().optional().allow(null),
        realEstateDetails: Joi.object({
            bedrooms: Joi.number().integer().min(0).optional().allow(null),
            bathrooms: Joi.number().integer().min(0).optional().allow(null),
            furnishing: Joi.number().integer().valid(1, 2, 3).optional().allow(null),
            parkingSlots: Joi.number().integer().min(0).optional().allow(null),
            facing: Joi.number().integer().min(1).max(8).optional().allow(null)
        }).optional()
    }),

    updateUnit: Joi.object({
        tenantId: Joi.string().uuid().optional(),
        propertyId: Joi.string().uuid().optional(),
        unitCategory: Joi.number().integer().valid(1, 2, 3, 4).optional(),
        unitCode: Joi.string().min(1).max(50).optional().allow('', null),
        slug: Joi.string().min(2).max(100).optional().allow('', null),
        floorNo: Joi.number().integer().min(0).optional().allow(null),
        capacity: Joi.number().integer().min(0).optional().allow(null),
        sizeSqft: Joi.number().integer().min(0).optional().allow(null),
        status: Joi.number().integer().valid(1, 2, 3, 4).optional(),
        mainImageId: Joi.string().uuid().optional().allow('', null),
        gallery: Joi.array().items(Joi.string().uuid()).optional().allow(null),
        unitPricing: Joi.array().items(Joi.object({
            price: Joi.number().required(),
            pricingModel: Joi.number().required(),
            currency: Joi.string().optional()
        })).optional(),
        hourlyRate: Joi.number().optional(),
        dailyRate: Joi.number().optional(),
        monthlyRate: Joi.number().optional(),
        currency: Joi.string().optional(),
        price: Joi.number().optional().allow(null),
        realEstateDetails: Joi.object({
            bedrooms: Joi.number().integer().min(0).optional().allow(null),
            bathrooms: Joi.number().integer().min(0).optional().allow(null),
            furnishing: Joi.number().integer().valid(1, 2, 3).optional().allow(null),
            parkingSlots: Joi.number().integer().min(0).optional().allow(null),
            facing: Joi.number().integer().min(1).max(8).optional().allow(null)
        }).optional()
    }),
};

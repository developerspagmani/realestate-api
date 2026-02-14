const Joi = require('joi');

const cmsValidation = {
    createPage: Joi.object({
        title: Joi.string().required().trim(),
        slug: Joi.string().required().trim().lowercase(),
        content: Joi.string().allow('', null),
        featureImageId: Joi.string().uuid().allow(null),
        seoTitle: Joi.string().allow('', null).trim(),
        seoDescription: Joi.string().allow('', null).trim(),
        seoKeywords: Joi.string().allow('', null).trim(),
        status: Joi.number().integer().valid(1, 2).default(1),
        publishedAt: Joi.date().allow(null),
        tenantId: Joi.string().uuid().optional()
    }),

    updatePage: Joi.object({
        title: Joi.string().trim(),
        slug: Joi.string().trim().lowercase(),
        content: Joi.string().allow('', null),
        featureImageId: Joi.string().uuid().allow(null),
        seoTitle: Joi.string().allow('', null).trim(),
        seoDescription: Joi.string().allow('', null).trim(),
        seoKeywords: Joi.string().allow('', null).trim(),
        status: Joi.number().integer().valid(1, 2),
        publishedAt: Joi.date().allow(null),
        tenantId: Joi.string().uuid().optional()
    })
};

module.exports = cmsValidation;

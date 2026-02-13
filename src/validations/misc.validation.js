const Joi = require('joi');

module.exports = {
    createReview: Joi.object({
        bookingId: Joi.string().required(),
        rating: Joi.number().integer().min(1).max(5).required(),
        comment: Joi.string().max(1000).optional(),
    }),

    processPayment: Joi.object({
        bookingId: Joi.string().required(),
        paymentMethod: Joi.string().required(),
        amount: Joi.number().positive().required(),
    }),
};

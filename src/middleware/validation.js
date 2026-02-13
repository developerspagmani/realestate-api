const Joi = require('joi');
const schemas = require('../validations');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);

    if (error) {
      const message = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: message
      });
    }

    next();
  };
};

module.exports = {
  validate,
  schemas,
};

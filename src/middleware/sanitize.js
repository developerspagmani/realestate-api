const { sanitizeObject } = require('../utils/sanitizer');

/**
 * Middleware to sanitize incoming request bodies
 */
const sanitizeBody = (req, res, next) => {
    if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
        req.body = sanitizeObject(req.body);
    }
    next();
};

module.exports = sanitizeBody;

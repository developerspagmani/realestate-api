/**
 * Simple HTML sanitizer to prevent basic XSS
 * In a real production environment, use a robust library like dompurify or sanitize-html
 */
const sanitize = (text) => {
    if (typeof text !== 'string') return text;

    return text
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
        .replace(/on\w+="[^"]*"/gim, "")
        .replace(/on\w+='[^']*'/gim, "")
        .replace(/javascript:/gim, "")
        .replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gim, "")
        .replace(/<object\b[^>]*>([\s\S]*?)<\/object>/gim, "");
};

const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;

    const newObj = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
        if (typeof obj[key] === 'string') {
            newObj[key] = sanitize(obj[key]);
        } else if (typeof obj[key] === 'object') {
            newObj[key] = sanitizeObject(obj[key]);
        } else {
            newObj[key] = obj[key];
        }
    }

    return newObj;
};

module.exports = { sanitize, sanitizeObject };

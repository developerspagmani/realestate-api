/**
 * Noop Cache utility (Redis removed)
 */
const cacheService = {
    set: async (key, value, ttlSeconds = 3600) => {
        return true;
    },

    get: async (key) => {
        return null;
    },

    del: async (key) => {
        return true;
    },

    delPattern: async (pattern) => {
        return true;
    }
};

module.exports = cacheService;

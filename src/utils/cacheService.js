/**
 * Noop Cache utility (Redis removed)
 */
const cacheService = {
    set: async (key, value, ttlSeconds = 3600) => {
        void key; void value; void ttlSeconds;
        return true;
    },

    get: async (key) => {
        void key;
        return null;
    },

    del: async (key) => {
        void key;
        return true;
    },

    delPattern: async (pattern) => {
        void pattern;
        return true;
    }
};

module.exports = cacheService;

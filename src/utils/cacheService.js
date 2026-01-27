const redis = require('../config/redis');

/**
 * Cache utility for storing and retrieving data from Redis
 */
const cacheService = {
    /**
     * Set a value in the cache with an expiration time
     * @param {string} key - The key to store the value under
     * @param {any} value - The value to store (will be JSON stringified)
     * @param {number} ttlSeconds - Time-to-live in seconds (default: 3600 = 1 hour)
     */
    set: async (key, value, ttlSeconds = 3600) => {
        try {
            const stringValue = JSON.stringify(value);
            await redis.set(key, stringValue, { EX: ttlSeconds });
            return true;
        } catch (error) {
            console.error(`Error setting cache key ${key}:`, error);
            return false;
        }
    },

    /**
     * Get a value from the cache
     * @param {string} key - The key to retrieve
     * @returns {Promise<any|null>} - The parsed value or null if not found
     */
    get: async (key) => {
        try {
            const data = await redis.get(key);
            if (!data) return null;
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error getting cache key ${key}:`, error);
            return null;
        }
    },

    /**
     * Delete a key from the cache
     * @param {string} key - The key to delete
     */
    del: async (key) => {
        try {
            await redis.del(key);
            return true;
        } catch (error) {
            console.error(`Error deleting cache key ${key}:`, error);
            return false;
        }
    },

    /**
     * Delete keys matching a pattern
     * @param {string} pattern - The pattern to match (e.g. "user:*")
     */
    delPattern: async (pattern) => {
        try {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(keys);
            }
            return true;
        } catch (error) {
            console.error(`Error deleting pattern ${pattern}:`, error);
            return false;
        }
    }
};

module.exports = cacheService;

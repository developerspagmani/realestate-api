const redis = require('redis');

// Create Redis Client
const client = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                console.error('Redis connection retries exhausted');
                return new Error('Redis connection retries exhausted');
            }
            return Math.min(retries * 50, 2000);
        }
    }
});

client.on('error', (err) => {
    console.error('Redis Client Error', err);
});

client.on('connect', () => {
    console.log('Redis Client Connected');
});

// Connect immediately
(async () => {
    try {
        if (!client.isOpen) {
            await client.connect();
        }
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
    }
})();

module.exports = client;

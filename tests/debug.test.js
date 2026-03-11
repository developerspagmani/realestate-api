const request = require('supertest');
const app = require('../src/app');

describe('Debug Auth', () => {
    test('POST /api/auth/login - Debug', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'admin@system.com',
                password: 'password123'
            });

        console.log('Status:', response.status);
        console.log('Body:', JSON.stringify(response.body, null, 2));
        expect(response.status).toBe(200);
    });
});

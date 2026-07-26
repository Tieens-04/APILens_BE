const { executeInSandbox } = require('../../src/services/swaggerExecutor.service');

describe('Swagger Executor Service (Sandboxed VM)', () => {
    it('should execute inline Express route app.post and return 201 status', async () => {
        const code = `
            app.post('/api/auth/register', (req, res) => {
                const { username, email } = req.body;
                if (!email) {
                    return res.status(400).json({ error: 'Email is required' });
                }
                return res.status(201).json({ success: true, user: { username, email } });
            });
        `;

        const result = await executeInSandbox({
            code,
            method: 'POST',
            path: '/api/auth/register',
            body: { username: 'testuser', email: 'test@example.com' },
        });

        expect(result.status).toBe(201);
        expect(result.body).toEqual({
            success: true,
            user: { username: 'testuser', email: 'test@example.com' },
        });
        expect(result.engine).toContain('APILens Ephemeral In-Memory Sandbox');
    });

    it('should catch validation logic errors (e.g. missing required email -> returns 400)', async () => {
        const code = `
            app.post('/api/auth/register', (req, res) => {
                const { email } = req.body;
                if (!email) {
                    return res.status(400).json({ error: 'Email is required' });
                }
                return res.status(200).json({ success: true });
            });
        `;

        const result = await executeInSandbox({
            code,
            method: 'POST',
            path: '/api/auth/register',
            body: {},
        });

        expect(result.status).toBe(400);
        expect(result.body).toEqual({ error: 'Email is required' });
    });

    it('should catch runtime errors in code and return status 500 with details', async () => {
        const code = `
            app.get('/api/users', (req, res) => {
                const nullObj = null;
                nullObj.doSomething(); // Will throw TypeError
            });
        `;

        const result = await executeInSandbox({
            code,
            method: 'GET',
            path: '/api/users',
        });

        expect(result.status).toBe(500);
        expect(result.body.error).toContain('Runtime Error');
    });

    it('should handle code with require statements without throwing require is not defined', async () => {
        const code = `
            const express = require('express');
            const jwt = require('jsonwebtoken');
            const router = express.Router();

            router.post('/register', (req, res) => {
                const { email } = req.body;
                res.status(200).json({ success: true, email });
            });
        `;

        const result = await executeInSandbox({
            code,
            method: 'POST',
            path: '/register',
            body: { email: 'test@example.com' },
        });

        expect(result.status).toBe(200);
        expect(result.body).toEqual({ success: true, email: 'test@example.com' });
    });
});

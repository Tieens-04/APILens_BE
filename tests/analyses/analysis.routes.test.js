const request = require('supertest');

jest.mock('../../src/middlewares/auth.middleware', () => ({
    protect: (req, res, next) => {
        req.user = {
            _id: '507f1f77bcf86cd799439011',
        };
        next();
    },
}));

const app = require('../../src/app');

describe('analysis routes', () => {
    jest.setTimeout(30000);

    test('analyzes VS Code file content synchronously', async () => {
        const content = [
            'const router = require("express").Router();',
            'router.get("/createUser", listUsers);',
            'router.get("/users/:id", getUser);',
        ].join('\n');

        const response = await request(app)
            .post('/api/v1/analyses/vscode')
            .set('Authorization', 'Bearer test-token')
            .send({
                sourceFile: 'src/routes/user.routes.js',
                fileType: 'express',
                content,
            });

        expect(response.status).toBe(200);
        expect(response.body.analysis.status).toBe('done');
        expect(response.body.analysis.endpointCount).toBe(2);
        expect(response.body.analysis.score).toBeLessThan(100);
        expect(response.body.analysis.smells.map((smell) => smell.ruleId)).toEqual(expect.arrayContaining(['R01', 'R02']));
    });

    test('analyzes local file content for the VS Code extension contract', async () => {
        const content = [
            'const router = require("express").Router();',
            'router.get("/createUser", listUsers);',
        ].join('\n');

        const response = await request(app)
            .post('/api/v1/analysis/file')
            .send({
                source: 'vscode',
                fileName: 'user.routes.js',
                filePath: 'src/routes/user.routes.js',
                fileType: 'express',
                content,
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.score).toBeLessThan(100);
        expect(response.body.data.summary).toEqual(expect.objectContaining({
            critical: expect.any(Number),
            warning: expect.any(Number),
            info: expect.any(Number),
        }));
        expect(response.body.data.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({
                rule: 'R02',
                ruleName: 'Verb in URL',
                severity: 'critical',
                filePath: 'src/routes/user.routes.js',
                line: 2,
            }),
        ]));
    });
});

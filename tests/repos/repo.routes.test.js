const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User.model');
const githubService = require('../../src/services/github.service');
const db = require('../db-handler');

describe('Repo Routes', () => {
    let token;

    beforeAll(async () => await db.connect());
    afterEach(async () => await db.clearDatabase());
    afterAll(async () => await db.closeDatabase());

    beforeEach(async () => {
        const user = await User.create({
            name: 'Test User',
            email: 'test@example.com',
            password: 'password123',
        });
        token = user.getSignedJwtToken();
    });

    describe('POST /api/v1/repos/scan', () => {
        it('should return 401 if user is not authenticated', async () => {
            const res = await request(app).post('/api/v1/repos/scan').send({
                repoUrl: 'https://github.com/test/repo',
            });
            expect(res.statusCode).toEqual(401);
        });

        it('should return 400 if repoUrl is not provided', async () => {
            const res = await request(app)
                .post('/api/v1/repos/scan')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('error');
        });

        it('should return 200 and scan results on successful scan', async () => {
            const mockScanResult = {
                endpoints: [{ method: 'GET', path: '/users' }],
                filesScanned: 1,
                totalFiles: 1,
            };
            githubService.scanRepository.mockResolvedValue(mockScanResult);

            const res = await request(app)
                .post('/api/v1/repos/scan')
                .set('Authorization', `Bearer ${token}`)
                .send({ repoUrl: 'https://github.com/test/repo' });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual(mockScanResult);
            
            const user = await User.findOne({ email: 'test@example.com' });
            expect(githubService.scanRepository).toHaveBeenCalledWith(user._id.toString(), 'https://github.com/test/repo');
        });

        it('should handle errors from githubService', async () => {
            githubService.scanRepository.mockRejectedValue(new Error('Scan failed'));


            const res = await request(app)
                .post('/api/v1/repos/scan')
                .set('Authorization', `Bearer ${token}`)
                .send({ repoUrl: 'https://github.com/test/repo' });

            expect(res.statusCode).toEqual(500);
        });
    });

    afterAll(async () => await db.closeDatabase());
});

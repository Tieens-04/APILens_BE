const request = require('supertest');

jest.mock('../../src/middlewares/auth.middleware', () => ({
    protect: (req, res, next) => {
        const authHeader = req.headers.authorization || '';

        if (!authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication token is required',
                    status: 401,
                },
            });
            return;
        }

        req.user = {
            _id: '507f1f77bcf86cd799439011',
        };
        next();
    },
}));

jest.mock('../../src/services/github.service', () => ({
    scanRepository: jest.fn(),
}));

const app = require('../../src/app');
const githubService = require('../../src/services/github.service');

describe('Repo Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
                .set('Authorization', 'Bearer test-token')
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
                .set('Authorization', 'Bearer test-token')
                .send({ repoUrl: 'https://github.com/test/repo' });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual(mockScanResult);
            expect(githubService.scanRepository).toHaveBeenCalledWith(
                '507f1f77bcf86cd799439011',
                'https://github.com/test/repo',
                {}
            );
        });

        it('should handle errors from githubService', async () => {
            githubService.scanRepository.mockRejectedValue(new Error('Scan failed'));


            const res = await request(app)
                .post('/api/v1/repos/scan')
                .set('Authorization', 'Bearer test-token')
                .send({ repoUrl: 'https://github.com/test/repo' });

            expect(res.statusCode).toEqual(500);
        });
    });
});

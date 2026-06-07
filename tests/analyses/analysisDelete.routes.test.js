jest.mock('../../src/middlewares/auth.middleware', () => ({
    protect: (req, res, next) => {
        req.user = {
            _id: '507f1f77bcf86cd799439011',
        };
        next();
    },
}));

jest.mock('../../src/services/analysis.service', () => ({
    deleteAnalysis: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439012' }),
    runAnalysis: jest.fn(),
    getAnalysisById: jest.fn(),
    listUserAnalyses: jest.fn(),
}));

const request = require('supertest');
const app = require('../../src/app');
const analysisService = require('../../src/services/analysis.service');

describe('analysis delete route', () => {
    test('deletes an analysis owned by the current user', async () => {
        const response = await request(app)
            .delete('/api/v1/analyses/507f1f77bcf86cd799439012')
            .set('Authorization', 'Bearer test-token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(analysisService.deleteAnalysis).toHaveBeenCalledWith(
            '507f1f77bcf86cd799439011',
            '507f1f77bcf86cd799439012'
        );
    });
});

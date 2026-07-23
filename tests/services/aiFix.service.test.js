const aiFixService = require('../../src/services/aiFix.service');
const ApiError = require('../../src/utils/ApiError');

describe('aiFixService', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = {
            ...originalEnv,
            AI_PROVIDER: '',
            AI_API_KEY: '',
            OPENAI_API_KEY: '',
            CLAUDE_API_KEY: '',
        };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('throws ApiError when no AI provider is configured', async () => {
        await expect(
            aiFixService.generateFix({
                content: 'const x = 1;',
                fileType: 'express',
                filePath: 'src/routes.js',
                smell: { smellName: 'Wrong HTTP Verb', description: 'uses POST' },
            })
        ).rejects.toThrow(ApiError);
    });

    test('throws ApiError when AI generated invalid code that fails parserService validation', async () => {
        process.env.AI_PROVIDER = 'openai';
        process.env.OPENAI_API_KEY = 'mock_key';

        // Mock global fetch to return syntax-broken code
        const mockResponse = {
            ok: true,
            json: async () => ({
                choices: [
                    {
                        message: {
                            content: '```javascript\nconst x = {\n```', // Unbalanced curly bracket is a syntax error!
                        },
                    },
                ],
            }),
        };

        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockResolvedValue(mockResponse);

        try {
            await expect(
                aiFixService.generateFix({
                    content: 'const x = 1;',
                    fileType: 'express',
                    filePath: 'src/routes.js',
                    smell: { smellName: 'Wrong HTTP Verb', description: 'uses POST' },
                })
            ).rejects.toThrow('AI generated invalid code structure');
        } finally {
            global.fetch = originalFetch;
        }
    });
});

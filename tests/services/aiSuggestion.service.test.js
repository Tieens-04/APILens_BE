const aiSuggestionService = require('../../src/services/aiSuggestion.service');

describe('aiSuggestionService', () => {
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

    test('returns fallback summary and per-smell suggestions when no AI provider is configured', async () => {
        const result = await aiSuggestionService.generateSuggestion({
            score: 55,
            endpointCount: 2,
            smells: [
                {
                    ruleId: 'R02',
                    smellName: 'Verb in URL',
                    severity: 'Critical',
                    weight: 15,
                    category: 'HTTP Design',
                    endpoints: ['POST /createUser'],
                    lineNumbers: [3],
                    description: 'URL contains an action verb.',
                    suggestion: '',
                },
            ],
        });

        expect(result.usedFallback).toBe(true);
        expect(result.provider).toBe('fallback');
        expect(result.aiSuggestion).toContain('critical');
        expect(result.smells[0].suggestion).toContain('/users');
    });

    test('builds a constrained dashboard-friendly prompt', () => {
        process.env.AI_RESPONSE_LANGUAGE = 'Vietnamese';

        const prompt = aiSuggestionService.buildPrompt({
            filePath: 'src/routes/users.js',
            score: 25,
            endpointCount: 2,
            smells: [
                {
                    ruleId: 'R04',
                    smellName: 'Missing Error Status Code',
                    severity: 'Critical',
                    category: 'Documentation',
                    endpoints: ['POST /createUser'],
                    lineNumbers: [2],
                    description: 'Endpoint does not document any response status codes.',
                    suggestion: 'Document success and error responses.',
                },
            ],
        });

        expect(prompt).toContain('Respond in Vietnamese');
        expect(prompt).toContain('Do not use emoji');
        expect(prompt).toContain('static analysis did not detect documented status codes');
        expect(prompt).toContain('## Priority fixes');
        expect(prompt).toContain('POST /createUser');
    });
});

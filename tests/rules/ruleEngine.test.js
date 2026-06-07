const { runRuleEngine } = require('../../src/rules');

describe('rule engine', () => {
    test('detects common REST API smells and calculates score', () => {
        const endpoints = [
            {
                method: 'GET',
                path: '/createUser',
                parameters: [],
                responses: {
                    200: {
                        description: 'OK',
                    },
                },
                lineNumber: 2,
            },
            {
                method: 'GET',
                path: '/users/:id',
                parameters: [],
                responses: {},
                lineNumber: 3,
            },
            {
                method: 'GET',
                path: '/api/v1/users',
                parameters: [
                    {
                        name: 'page',
                    },
                    {
                        name: 'limit',
                    },
                ],
                responses: {
                    200: {
                        description: 'OK',
                    },
                    400: {
                        description: 'Bad Request',
                    },
                },
                lineNumber: 4,
            },
        ];

        const result = runRuleEngine(endpoints, {
            content: 'const apiKey = "super-secret-token";',
        });

        expect(result.endpointCount).toBe(3);
        expect(result.score).toBeLessThan(100);
        expect(result.severitySummary.critical).toBeGreaterThan(0);
        expect(result.smells.map((smell) => smell.ruleId)).toEqual(expect.arrayContaining([
            'R01',
            'R02',
            'R04',
            'R06',
            'R07',
            'R08',
        ]));
    });

    test('keeps a clean versioned endpoint high scoring', () => {
        const endpoints = [
            {
                method: 'GET',
                path: '/api/v1/users',
                parameters: [
                    {
                        name: 'page',
                    },
                    {
                        name: 'limit',
                    },
                ],
                responses: {
                    200: {
                        description: 'OK',
                    },
                    404: {
                        description: 'Not Found',
                    },
                },
            },
        ];

        const result = runRuleEngine(endpoints);

        expect(result.score).toBe(100);
        expect(result.smells).toHaveLength(0);
    });
});

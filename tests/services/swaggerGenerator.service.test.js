const { generateOpenApiSpec, sanitizeValue, sanitizeDeep } = require('../../src/services/swaggerGenerator.service');

describe('Swagger Generator Service', () => {
    describe('Secret Sanitizer', () => {
        it('should redact Bearer tokens', () => {
            const raw = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.testToken';
            expect(sanitizeValue(raw)).toContain('[REDACTED_SECRET]');
        });

        it('should redact secret keys and passwords in deep objects', () => {
            const data = {
                username: 'admin',
                password: 'superSecretPassword123',
                apiKey: 'sk-1234567890abcdef1234567890',
            };
            const sanitized = sanitizeDeep(data);
            expect(sanitized.password).toBe('[REDACTED_SECRET]');
            expect(sanitized.apiKey).toBe('[REDACTED_SECRET]');
            expect(sanitized.username).toBe('admin');
        });
    });

    describe('generateOpenApiSpec', () => {
        it('should generate valid OpenAPI 3.0 spec from endpoints array', () => {
            const endpoints = [
                {
                    method: 'GET',
                    path: '/api/v1/users/:id',
                    description: 'Get user by ID',
                    responses: { '200': { id: '1', name: 'John Doe' } },
                },
                {
                    method: 'POST',
                    path: '/api/v1/users',
                    description: 'Create user',
                    requestBody: { name: 'John Doe', email: 'john@example.com' },
                },
            ];

            const spec = generateOpenApiSpec({
                title: 'Test API',
                endpoints,
                serverUrl: 'http://localhost:5000',
            });

            expect(spec.openapi).toBe('3.0.3');
            expect(spec.info.title).toBe('Test API');
            expect(spec.servers[0].url).toBe('http://localhost:5000');
            expect(spec.paths['/api/v1/users/{id}']).toBeDefined();
            expect(spec.paths['/api/v1/users/{id}'].get).toBeDefined();
            expect(spec.paths['/api/v1/users'].post).toBeDefined();
        });
    });
});

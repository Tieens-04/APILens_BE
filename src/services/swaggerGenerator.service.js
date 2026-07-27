/**
 * Swagger (OpenAPI 3.0.3) Spec Generator Service with Secret Sanitization
 */

const SECRET_PATTERNS = [
    /bearer\s+[a-z0-9._~+/-]+=*/i,
    /sk-[a-z0-9]{20,}/i,
    /ghp_[a-z0-9]{36}/i,
    /mongodb(\+srv)?:\/\/[^\s]+/i,
    /postgres:\/\/[^\s]+/i,
    /mysql:\/\/[^\s]+/i,
    /redis:\/\/[^\s]+/i,
    /secret[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
    /password\s*[:=]\s*['"][^'"]+['"]/i,
];

/**
 * Sanitizes strings to prevent sensitive credentials from leaking into Swagger specs.
 */
const sanitizeValue = (val) => {
    if (typeof val !== 'string') return val;
    let sanitized = val;
    SECRET_PATTERNS.forEach((pattern) => {
        sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
    });
    return sanitized;
};

/**
 * Recursively sanitizes objects/arrays.
 */
const sanitizeDeep = (obj) => {
    if (!obj) return obj;
    if (typeof obj === 'string') return sanitizeValue(obj);
    if (Array.isArray(obj)) return obj.map(sanitizeDeep);
    if (typeof obj === 'object') {
        const cleaned = {};
        for (const [key, val] of Object.entries(obj)) {
            if (/password|secret|token|auth|key|cred/i.test(key) && typeof val === 'string') {
                cleaned[key] = '[REDACTED_SECRET]';
            } else {
                cleaned[key] = sanitizeDeep(val);
            }
        }
        return cleaned;
    }
    return obj;
};

/**
 * Formats Express path parameters (e.g. /users/:id or /users/:userId -> /users/{id} or /users/{userId})
 */
const formatPathForSwagger = (path) => {
    if (!path) return '/';
    let formatted = path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
    if (!formatted.startsWith('/')) {
        formatted = '/' + formatted;
    }
    return formatted;
};

/**
 * Infers a realistic request body example based on path, method, or existing body data
 */
const getSmartDefaultRequestBody = (path = '', method = '', existingBody = null) => {
    // 1. If existingBody is provided and has actual properties (not empty object and not { example: 'data' }), use it
    if (existingBody && typeof existingBody === 'object' && !Array.isArray(existingBody)) {
        const keys = Object.keys(existingBody);
        if (keys.length > 0 && !(keys.length === 1 && keys[0] === 'example' && existingBody.example === 'data')) {
            return existingBody;
        }
    }

    const lowerPath = String(path).toLowerCase();

    // 2. Infer smart default body from endpoint path
    if (lowerPath.includes('login') || lowerPath.includes('signin') || lowerPath.includes('auth/token')) {
        return { email: 'user@example.com', password: 'SecureP@ss123' };
    }
    if (lowerPath.includes('register') || lowerPath.includes('signup') || lowerPath.includes('user/create')) {
        return { username: 'john_doe', email: 'user@example.com', password: 'SecureP@ss123' };
    }
    if (lowerPath.includes('forgot') || lowerPath.includes('reset') || lowerPath.includes('recover')) {
        return { email: 'user@example.com' };
    }
    if (lowerPath.includes('pr') || lowerPath.includes('pull-request')) {
        return { title: 'Fix API smell', branchName: 'fix/api-smell', description: 'Auto-generated fix PR' };
    }
    if (lowerPath.includes('comment') || lowerPath.includes('review') || lowerPath.includes('feedback')) {
        return { content: 'This is a sample comment message' };
    }
    if (lowerPath.includes('product') || lowerPath.includes('item') || lowerPath.includes('order')) {
        return { name: 'Sample Item', price: 99.99, quantity: 1 };
    }
    if (lowerPath.includes('profile') || lowerPath.includes('user')) {
        return { name: 'John Doe', email: 'user@example.com', bio: 'Sample bio' };
    }

    // 3. General fallback if no path match
    return { name: 'Sample Request Data', description: 'Sample description text' };
};

/**
 * Converts APILens endpoints into a valid OpenAPI 3.0.3 Spec
 */
const generateOpenApiSpec = ({ title, version = '1.0.0', description = '', endpoints = [], serverUrl = 'http://localhost:5000' }) => {
    const sanitizedTitle = sanitizeValue(title || 'API Specification');
    const sanitizedDescription = sanitizeValue(description || 'Auto-generated OpenAPI 3.0 Spec by APILens');

    const openApiSpec = {
        openapi: '3.0.3',
        info: {
            title: sanitizedTitle,
            description: sanitizedDescription,
            version: version,
        },
        servers: [
            {
                url: serverUrl,
                description: 'Target API Server',
            },
        ],
        paths: {},
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-API-Key',
                },
            },
        },
    };

    endpoints.forEach((ep) => {
        const method = (ep.method || 'get').toLowerCase();
        const swaggerPath = formatPathForSwagger(ep.path);

        if (!openApiSpec.paths[swaggerPath]) {
            openApiSpec.paths[swaggerPath] = {};
        }

        // Extract path parameters from swaggerPath {param}
        const pathParamsMatches = swaggerPath.match(/\{([a-zA-Z0-9_]+)\}/g) || [];
        const swaggerParameters = [];

        pathParamsMatches.forEach((paramMatch) => {
            const paramName = paramMatch.replace(/[\{\}]/g, '');
            swaggerParameters.push({
                name: paramName,
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: `Parameter ${paramName}`,
            });
        });

        // Add additional query/header parameters if present
        if (Array.isArray(ep.parameters)) {
            ep.parameters.forEach((p) => {
                if (typeof p === 'object' && p.name && p.in && p.in !== 'path') {
                    swaggerParameters.push(sanitizeDeep({
                        name: p.name,
                        in: p.in,
                        required: Boolean(p.required),
                        schema: p.schema || { type: 'string' },
                        description: p.description || '',
                    }));
                }
            });
        }

        const operation = {
            summary: sanitizeValue(ep.description || `${method.toUpperCase()} ${swaggerPath}`),
            description: sanitizeValue(ep.description || `Endpoint ${method.toUpperCase()} ${swaggerPath}`),
            parameters: swaggerParameters,
            responses: {
                '200': {
                    description: 'Successful response',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                example: sanitizeDeep(ep.responses?.['200'] || { success: true, message: 'OK' }),
                            },
                        },
                    },
                },
                '400': { description: 'Bad Request' },
                '401': { description: 'Unauthorized' },
                '404': { description: 'Not Found' },
                '500': { description: 'Internal Server Error' },
            },
        };

        if (['post', 'put', 'patch'].includes(method)) {
            const rawBodyExample = ep.requestBody || ep.body;
            const inferredBody = getSmartDefaultRequestBody(swaggerPath, method, rawBodyExample);

            operation.requestBody = {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            example: sanitizeDeep(inferredBody),
                        },
                    },
                },
            };
        }

        openApiSpec.paths[swaggerPath][method] = operation;
    });

    return openApiSpec;
};

module.exports = {
    generateOpenApiSpec,
    sanitizeValue,
    sanitizeDeep,
};

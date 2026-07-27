/**
 * Converter Service: Converts OpenAPI 3.0 Specification into Postman Collection v2.1.0 JSON format.
 */

const getSmartDefaultBody = (path = '', _method = '', existingExample = null) => {
    if (existingExample && typeof existingExample === 'object' && !Array.isArray(existingExample)) {
        const keys = Object.keys(existingExample);
        if (keys.length > 0 && !(keys.length === 1 && keys[0] === 'example' && existingExample.example === 'data')) {
            return existingExample;
        }
    }

    const lowerPath = String(path).toLowerCase();
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

    return { name: 'Sample Request Data', description: 'Sample description text' };
};

const convertOpenApiToPostman = (openApiSpec) => {
    const title = openApiSpec.info?.title || 'APILens Collection';
    const description = openApiSpec.info?.description || 'Exported from APILens OpenAPI 3.0 Spec';

    const items = [];

    const paths = openApiSpec.paths || {};

    Object.entries(paths).forEach(([pathStr, methodsObj]) => {
        if (!methodsObj || typeof methodsObj !== 'object') return;

        Object.entries(methodsObj).forEach(([methodStr, op]) => {
            const methodUpper = methodStr.toUpperCase();
            if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(methodUpper)) return;

            // Format Postman URL path segments
            const cleanPath = pathStr.replace(/{([a-zA-Z0-9_]+)}/g, ':$1');
            const pathSegments = cleanPath.split('/').filter(Boolean);

            const queryParams = (op.parameters || []).filter((p) => p.in === 'query');
            const headerParams = (op.parameters || []).filter((p) => p.in === 'header');
            const queryString = queryParams.map((p) => `${p.name}=`).join('&');

            const header = [
                {
                    key: 'Content-Type',
                    value: 'application/json',
                    type: 'text',
                },
                ...(op.security ? [{ key: 'Authorization', value: 'Bearer {{authToken}}', type: 'text' }] : []),
                ...headerParams.map((p) => ({ key: p.name, value: '', type: 'text', description: p.description || '' })),
            ];

            const postmanItem = {
                name: `${methodUpper} ${pathStr} - ${op.summary || 'Endpoint'}`,
                request: {
                    method: methodUpper,
                    header,
                    url: {
                        raw: `{{baseUrl}}${cleanPath}${queryString ? `?${queryString}` : ''}`,
                        host: ['{{baseUrl}}'],
                        path: pathSegments,
                        query: queryParams.map((p) => ({ key: p.name, value: '', description: p.description || '', disabled: !p.required })),
                    },
                    description: op.description || op.summary || '',
                },
                response: [],
            };

            // Convert Request Body
            if (['POST', 'PUT', 'PATCH'].includes(methodUpper)) {
                const rawExample = op.requestBody?.content?.['application/json']?.schema?.example;
                const bodyData = getSmartDefaultBody(pathStr, methodUpper, rawExample);
                postmanItem.request.body = {
                    mode: 'raw',
                    raw: JSON.stringify(bodyData, null, 2),
                    options: {
                        raw: {
                            language: 'json',
                        },
                    },
                };
            }

            // Convert Response Examples
            if (op.responses) {
                Object.entries(op.responses).forEach(([statusCode, resObj]) => {
                    const exampleData = resObj?.content?.['application/json']?.schema?.example;
                    postmanItem.response.push({
                        name: `${statusCode} ${resObj.description || 'Response'}`,
                        originalRequest: postmanItem.request,
                        status: statusCode === '201' ? 'Created' : statusCode === '200' ? 'OK' : 'Response',
                        code: parseInt(statusCode, 10) || 200,
                        _postman_previewlanguage: 'json',
                        header: [{ key: 'Content-Type', value: 'application/json' }],
                        body: exampleData ? JSON.stringify(exampleData, null, 2) : '',
                    });
                });
            }

            items.push(postmanItem);
        });
    });

    return {
        info: {
            name: title,
            description,
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        variable: [
            {
                key: 'baseUrl',
                value: openApiSpec.servers?.[0]?.url || 'http://localhost:5000',
                type: 'string',
            },
        ],
        item: items,
    };
};

module.exports = {
    convertOpenApiToPostman,
};

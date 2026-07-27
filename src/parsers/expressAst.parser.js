const acorn = require('acorn');
const { normalizeEndpoint } = require('./normalizeEndpoint');
const ApiError = require('../utils/ApiError');

const SUPPORTED_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

const normalizeBasePath = (basePath) => {
    if (!basePath) {
        return '';
    }

    const normalized = basePath.trim().replace(/\/$/, '');

    return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const joinPaths = (basePath, routePath) => {
    const normalizedBasePath = normalizeBasePath(basePath);

    if (!normalizedBasePath) {
        return routePath;
    }

    if (routePath === '/') {
        return normalizedBasePath;
    }

    return `${normalizedBasePath}${routePath.startsWith('/') ? routePath : `/${routePath}`}`;
};

const getLeadingComment = (comments, lineNumber) => {
    const previousComments = comments
        .filter((comment) => comment.loc.end.line < lineNumber)
        .sort((a, b) => b.loc.end.line - a.loc.end.line);

    const nearestComment = previousComments[0];

    if (!nearestComment || lineNumber - nearestComment.loc.end.line > 2) {
        return '';
    }

    return nearestComment.value;
};

const getBasePath = (comments) => {
    const basePathComment = comments
        .map((comment) => comment.value)
        .find((value) => /@apilens\s+basePath\s+/i.test(value));

    if (basePathComment) {
        return basePathComment.match(/@apilens\s+basePath\s+([^\s*]+)/i)?.[1] || '';
    }

    // Also try to detect versioned prefix from general comment blocks like "GET /api/v1/cart"
    for (const comment of comments) {
        const match = comment.value.match(/\b\/(?:api\/)?v\d+(?:\/[A-Za-z0-9_/-]+)?/i);
        if (match) {
            // Extract just the /api/v1 prefix
            const versionMatch = match[0].match(/^\/(?:api\/)?v\d+/i);
            if (versionMatch) {
                return versionMatch[0];
            }
        }
    }

    return '';
};

const getDocumentedResponses = (comment = '') => {
    const responses = {};

    // Pattern 1: @apilens responses 200, 400, 401
    const responseMatch = comment.match(/@apilens\s+responses\s+([0-9,\s]+)/i);
    if (responseMatch) {
        responseMatch[1]
            .split(',')
            .map((statusCode) => statusCode.trim())
            .filter(Boolean)
            .forEach((statusCode) => {
                responses[statusCode] = { description: `Documented ${statusCode} response` };
            });
    }

    // Pattern 2: JSDoc @returns {200} or @returns 200 or @response {200} or @returns {400}
    const jsdocReturnMatches = [...comment.matchAll(/@(?:returns?|response)\s*\{?\s*([1-5]\d\d)\s*\}?/gi)];
    jsdocReturnMatches.forEach((match) => {
        const statusCode = match[1];
        responses[statusCode] = { description: `Documented ${statusCode} response` };
    });

    return responses;
};

const getDocumentedParameters = (comment = '') => {
    const parameters = [];
    const seenNames = new Set();

    // Pattern 1: @apilens param name [in]
    const apilensParamMatches = [...comment.matchAll(/@apilens\s+param\s+([A-Za-z0-9_]+)(?:\s+(path|query|header|body))?/gi)];
    apilensParamMatches.forEach((match) => {
        const name = match[1];
        if (!seenNames.has(name)) {
            seenNames.add(name);
            parameters.push({ name, in: match[2] || 'path' });
        }
    });

    // Pattern 2: JSDoc @param {type} name or @param name
    const jsdocParamMatches = [...comment.matchAll(/@param\s+(?:\{[^}]*\}\s+)?([A-Za-z0-9_]+)/gi)];
    jsdocParamMatches.forEach((match) => {
        const name = match[1];
        if (!seenNames.has(name)) {
            seenNames.add(name);
            parameters.push({ name, in: 'path' });
        }
    });

    return parameters;
};

const walk = (node, visitor) => {
    if (!node || typeof node.type !== 'string') {
        return;
    }

    visitor(node);

    for (const key of Object.keys(node)) {
        if (key === 'parent') {
            continue;
        }

        const value = node[key];

        if (Array.isArray(value)) {
            value.forEach((child) => walk(child, visitor));
        } else if (value && typeof value.type === 'string') {
            walk(value, visitor);
        }
    }
};

const getLiteralValue = (node) => {
    if (!node) {
        return null;
    }

    if (node.type === 'Literal' && typeof node.value === 'string') {
        return node.value;
    }

    if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
        return node.quasis[0]?.value?.cooked || node.quasis[0]?.value?.raw || null;
    }

    return null;
};

const getRouteCall = (node) => {
    if (node.type !== 'CallExpression' || node.callee?.type !== 'MemberExpression') {
        return null;
    }

    const propertyName = node.callee.property?.name || node.callee.property?.value;
    const objectName = node.callee.object?.name;
    const methodLineNumber = node.callee.property?.loc?.start?.line || node.loc?.start?.line || null;

    if (!SUPPORTED_METHODS.has(propertyName)) {
        return null;
    }

    let chainObject = node.callee.object;

    while (chainObject?.type === 'CallExpression') {
        const routeCallee = chainObject.callee;

        if (routeCallee?.type === 'MemberExpression') {
            const routeMethodName = routeCallee.property?.name || routeCallee.property?.value;
            const routeObjectName = routeCallee.object?.name;
            const routePath = getLiteralValue(chainObject.arguments[0]);

            if (routeMethodName === 'route' && routeObjectName && routePath) {
                return {
                    method: propertyName,
                    objectName: routeObjectName,
                    path: routePath,
                    lineNumber: methodLineNumber,
                };
            }

            chainObject = routeCallee.object;
            continue;
        }

        break;
    }

    if (!objectName) {
        return null;
    }

    const path = getLiteralValue(node.arguments[0]);

    if (!path) {
        return null;
    }

    return {
        method: propertyName,
        objectName,
        path,
        lineNumber: methodLineNumber,
    };
};

/**
 * Extracts req.body fields from route handler functions by analyzing AST patterns:
 * - Destructuring: const { email, password } = req.body;
 * - Direct access: req.body.email, req.body.password
 * Returns an object with field names and example values inferred from field names.
 */
const extractReqBodyFields = (routeCallNode) => {
    const fields = new Set();

    // Get handler functions from route call arguments (skip path string, skip middleware)
    const handlers = (routeCallNode.arguments || []).filter(
        (arg) => arg.type === 'FunctionExpression' || arg.type === 'ArrowFunctionExpression'
    );

    handlers.forEach((handler) => {
        walk(handler, (node) => {
            // Pattern 1: const { field1, field2 } = req.body;
            if (
                node.type === 'VariableDeclarator' &&
                node.id?.type === 'ObjectPattern' &&
                node.init?.type === 'MemberExpression' &&
                node.init.object?.name === 'req' &&
                node.init.property?.name === 'body'
            ) {
                node.id.properties.forEach((prop) => {
                    const name = prop.key?.name || prop.key?.value;
                    if (name) fields.add(name);
                });
            }

            // Pattern 2: req.body.fieldName
            if (
                node.type === 'MemberExpression' &&
                node.object?.type === 'MemberExpression' &&
                node.object.object?.name === 'req' &&
                node.object.property?.name === 'body' &&
                node.property?.name
            ) {
                fields.add(node.property.name);
            }
        });
    });

    if (fields.size === 0) return null;

    // Generate realistic example values based on field name patterns
    const exampleBody = {};
    fields.forEach((field) => {
        const lower = field.toLowerCase();
        if (lower.includes('email')) exampleBody[field] = 'user@example.com';
        else if (lower.includes('password') || lower.includes('passwd')) exampleBody[field] = 'SecureP@ss123';
        else if (lower.includes('name') && lower.includes('user')) exampleBody[field] = 'john_doe';
        else if (lower.includes('firstname') || lower.includes('first_name')) exampleBody[field] = 'John';
        else if (lower.includes('lastname') || lower.includes('last_name')) exampleBody[field] = 'Doe';
        else if (lower === 'name') exampleBody[field] = 'John Doe';
        else if (lower.includes('phone') || lower.includes('tel')) exampleBody[field] = '+84901234567';
        else if (lower.includes('url') || lower.includes('link') || lower.includes('website')) exampleBody[field] = 'https://example.com';
        else if (lower.includes('avatar') || lower.includes('image') || lower.includes('photo')) exampleBody[field] = 'https://example.com/avatar.jpg';
        else if (lower.includes('address')) exampleBody[field] = '123 Main St, Ho Chi Minh City';
        else if (lower.includes('title')) exampleBody[field] = 'Sample Title';
        else if (lower.includes('description') || lower.includes('desc') || lower.includes('content') || lower.includes('body') || lower.includes('message') || lower.includes('text') || lower.includes('comment') || lower.includes('note')) exampleBody[field] = 'Sample description text';
        else if (lower.includes('age')) exampleBody[field] = 25;
        else if (lower.includes('price') || lower.includes('amount') || lower.includes('cost') || lower.includes('total') || lower.includes('salary')) exampleBody[field] = 99.99;
        else if (lower.includes('quantity') || lower.includes('qty') || lower.includes('count') || lower.includes('num')) exampleBody[field] = 1;
        else if (lower.includes('id')) exampleBody[field] = '507f1f77bcf86cd799439011';
        else if (lower.includes('date') || lower.includes('time') || lower.includes('created') || lower.includes('updated')) exampleBody[field] = '2026-01-01T00:00:00.000Z';
        else if (lower.includes('active') || lower.includes('enabled') || lower.includes('verified') || lower.includes('is_') || lower.includes('has_')) exampleBody[field] = true;
        else if (lower.includes('role') || lower.includes('type') || lower.includes('status') || lower.includes('plan')) exampleBody[field] = 'user';
        else if (lower.includes('token') || lower.includes('code') || lower.includes('key')) exampleBody[field] = 'abc123xyz';
        else if (lower.includes('repo') || lower.includes('repository')) exampleBody[field] = 'owner/repo-name';
        else if (lower.includes('branch')) exampleBody[field] = 'main';
        else if (lower.includes('file') || lower.includes('path')) exampleBody[field] = 'src/index.js';
        else if (lower.includes('tags') || lower.includes('categories') || lower.includes('items')) exampleBody[field] = ['item1', 'item2'];
        else exampleBody[field] = `sample_${field}`;
    });

    return exampleBody;
};

const getMountCall = (node) => {
    if (node.type !== 'CallExpression' || node.callee?.type !== 'MemberExpression') {
        return null;
    }

    const propertyName = node.callee.property?.name || node.callee.property?.value;

    if (propertyName !== 'use') {
        return null;
    }

    const parentRouterName = node.callee.object?.name;
    const mountPath = getLiteralValue(node.arguments[0]);
    const mountedRouterName = node.arguments[1]?.name;

    if (!parentRouterName || !mountPath || !mountedRouterName) {
        return null;
    }

    return {
        parentRouterName,
        mountedRouterName,
        mountPath,
    };
};

const collectMountBasePaths = (ast, rootBasePath) => {
    const baseByRouterName = {
        app: rootBasePath,
        router: rootBasePath,
    };
    const mounts = [];

    walk(ast, (node) => {
        const mountCall = getMountCall(node);

        if (mountCall) {
            mounts.push(mountCall);
        }
    });

    let changed = true;

    while (changed) {
        changed = false;
        mounts.forEach((mount) => {
            const parentBasePath = baseByRouterName[mount.parentRouterName] || '';
            const nextBasePath = joinPaths(parentBasePath, mount.mountPath);

            if (baseByRouterName[mount.mountedRouterName] !== nextBasePath) {
                baseByRouterName[mount.mountedRouterName] = nextBasePath;
                changed = true;
            }
        });
    }

    return baseByRouterName;
};

const parseExpressAst = (content, options = {}) => {
    let ast;
    const comments = [];

    try {
        ast = acorn.parse(content, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            locations: true,
            onComment: comments,
        });
    } catch (error) {
        try {
            ast = acorn.parse(content, {
                ecmaVersion: 'latest',
                sourceType: 'script',
                locations: true,
                onComment: comments,
            });
        } catch (scriptError) {
            throw new ApiError(422, `Express file could not be parsed: ${scriptError.message}`, 'PARSE_FAILED');
        }
    }

    const endpoints = [];
    const basePath = options.basePath || getBasePath(comments);
    const baseByRouterName = collectMountBasePaths(ast, basePath);

    walk(ast, (node) => {
        const routeCall = getRouteCall(node);

        if (!routeCall) {
            return;
        }

        const leadingComment = getLeadingComment(comments, routeCall.lineNumber);

        // Extract req.body fields from handler for POST/PUT/PATCH methods
        const reqBodyFields = ['post', 'put', 'patch'].includes(routeCall.method)
            ? extractReqBodyFields(node)
            : null;

        endpoints.push(normalizeEndpoint({
            method: routeCall.method,
            path: joinPaths(baseByRouterName[routeCall.objectName] || basePath, routeCall.path),
            parameters: getDocumentedParameters(leadingComment),
            responses: getDocumentedResponses(leadingComment),
            requestBody: reqBodyFields,
            sourceFile: options.sourceFile,
            lineNumber: routeCall.lineNumber,
            raw: {
                parser: 'express',
                originalPath: routeCall.path,
            },
        }));
    });

    return {
        fileType: 'express',
        endpointCount: endpoints.length,
        endpoints: endpoints.sort((a, b) => (a.lineNumber || 0) - (b.lineNumber || 0)),
        warnings: endpoints.length === 0
            ? ['No supported Express route patterns were found. Supported patterns: router.get/post/put/patch/delete(path, handler) and app.get/post/put/patch/delete(path, handler).']
            : [],
    };
};

module.exports = {
    parseExpressAst,
};

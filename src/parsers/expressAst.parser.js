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

    return basePathComment?.match(/@apilens\s+basePath\s+([^\s*]+)/i)?.[1] || '';
};

const getDocumentedResponses = (comment = '') => {
    const responseMatch = comment.match(/@apilens\s+responses\s+([0-9,\s]+)/i);

    if (!responseMatch) {
        return {};
    }

    return responseMatch[1]
        .split(',')
        .map((statusCode) => statusCode.trim())
        .filter(Boolean)
        .reduce((responses, statusCode) => {
            responses[statusCode] = {
                description: `Documented ${statusCode} response`,
            };
            return responses;
        }, {});
};

const getDocumentedParameters = (comment = '') => {
    const paramMatches = [...comment.matchAll(/@apilens\s+param\s+([A-Za-z0-9_]+)(?:\s+(path|query|header|body))?/gi)];

    return paramMatches.map((match) => ({
        name: match[1],
        in: match[2] || 'path',
    }));
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

        endpoints.push(normalizeEndpoint({
            method: routeCall.method,
            path: joinPaths(baseByRouterName[routeCall.objectName] || basePath, routeCall.path),
            parameters: getDocumentedParameters(leadingComment),
            responses: getDocumentedResponses(leadingComment),
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

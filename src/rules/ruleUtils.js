const formatEndpoint = (endpoint) => `${endpoint.method} ${endpoint.path}`;

const getPathSegments = (path) => String(path || '').split('/').filter(Boolean);

const getPathParams = (path) => getPathSegments(path)
    .filter((segment) => segment.startsWith(':') || (segment.startsWith('{') && segment.endsWith('}')))
    .map((segment) => segment.replace(/^[:{]/, '').replace(/}$/, ''));

const getDocumentedParamNames = (endpoint) => (endpoint.parameters || [])
    .map((parameter) => parameter.name || parameter.key)
    .filter(Boolean);

const hasAnyResponseCode = (endpoint, matcher) => Object.keys(endpoint.responses || {}).some((statusCode) => matcher(Number(statusCode)));

const hasPaginationParam = (endpoint) => {
    const names = getDocumentedParamNames(endpoint).map((name) => name.toLowerCase());

    return names.some((name) => ['page', 'limit', 'offset', 'cursor', 'per_page', 'page_size'].includes(name));
};

const isCollectionGet = (endpoint) => {
    if (endpoint.method !== 'GET') {
        return false;
    }

    const segments = getPathSegments(endpoint.path);
    const lastSegment = segments[segments.length - 1] || '';
    const ignoredSingletonOrActionSegments = new Set([
        'me',
        'callback',
        'tree',
        'branches',
        'health',
        'google',
        'github',
    ]);

    if (ignoredSingletonOrActionSegments.has(lastSegment.toLowerCase())) {
        return false;
    }

    if (segments.some((segment) => segment.startsWith(':') || (segment.startsWith('{') && segment.endsWith('}')))) {
        return false;
    }

    return true;
};

const createSmell = (definition, endpoint, description, suggestion, extra = {}) => ({
    ruleId: definition.ruleId,
    smellName: definition.smellName,
    severity: definition.severity,
    weight: definition.weight,
    category: definition.category,
    endpoints: endpoint ? [formatEndpoint(endpoint)] : [],
    lineNumbers: endpoint?.lineNumber ? [endpoint.lineNumber] : [],
    description,
    suggestion,
    ...extra,
});

module.exports = {
    createSmell,
    formatEndpoint,
    getPathSegments,
    getPathParams,
    getDocumentedParamNames,
    hasAnyResponseCode,
    hasPaginationParam,
    isCollectionGet,
};

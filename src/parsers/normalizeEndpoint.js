const normalizeMethod = (method) => String(method || '').toUpperCase();

const normalizePath = (path) => {
    if (!path) {
        return '';
    }

    const normalized = String(path).trim();

    return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const normalizeEndpoint = ({
    method,
    path,
    parameters = [],
    responses = {},
    requestBody = undefined,
    headers = [],
    body = undefined,
    description = '',
    sourceFile = '',
    lineNumber = null,
    raw = undefined,
}) => ({
    method: normalizeMethod(method),
    path: normalizePath(path),
    parameters,
    responses,
    requestBody,
    headers,
    body,
    description,
    sourceFile,
    lineNumber,
    raw,
});

module.exports = {
    normalizeEndpoint,
    normalizeMethod,
    normalizePath,
};

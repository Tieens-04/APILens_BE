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
    security = false,
    // Whether `requestBody`/`body` is a value APILens invented itself (from a
    // field-name heuristic, e.g. a "password" field defaults to a fake
    // 'SecureP@ss123') rather than real data a user typed into a Postman
    // collection they imported. Defaults to false (treat as possibly-real,
    // the safe default) so any parser that doesn't explicitly mark its output
    // as synthetic still gets secret-redaction applied.
    bodyIsSynthetic = false,
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
    security: Boolean(security),
    bodyIsSynthetic: Boolean(bodyIsSynthetic),
    sourceFile,
    lineNumber,
    raw,
});

module.exports = {
    normalizeEndpoint,
    normalizeMethod,
    normalizePath,
};

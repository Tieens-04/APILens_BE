const { normalizeEndpoint } = require('./normalizeEndpoint');
const ApiError = require('../utils/ApiError');

const normalizePostmanUrl = (url) => {
    if (!url) {
        return '';
    }

    if (typeof url === 'string') {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.pathname || '/';
        } catch (error) {
            return url.startsWith('/') ? url : `/${url}`;
        }
    }

    if (Array.isArray(url.path)) {
        return `/${url.path.join('/')}`;
    }

    if (url.raw) {
        try {
            const parsedUrl = new URL(url.raw.replace('{{baseUrl}}', 'http://example.com'));
            return parsedUrl.pathname || '/';
        } catch (error) {
            const withoutProtocol = url.raw.replace(/^https?:\/\/[^/]+/i, '');
            return withoutProtocol.startsWith('/') ? withoutProtocol : `/${withoutProtocol}`;
        }
    }

    return '';
};

/**
 * Converts Postman `url.query` / `header` arrays ({ key, value, disabled }) into
 * OpenAPI-style parameter objects ({ name, in, required, schema }) so downstream
 * consumers (swaggerGenerator) can read them consistently regardless of source parser.
 */
const toSwaggerParameters = (queryParams = [], headerParams = []) => {
    const parameters = [];

    (queryParams || []).forEach((q) => {
        if (!q || !q.key) return;
        parameters.push({
            name: q.key,
            in: 'query',
            required: !q.disabled,
            schema: { type: 'string' },
            description: q.description || '',
        });
    });

    (headerParams || []).forEach((h) => {
        if (!h || !h.key || /^authorization$/i.test(h.key)) return;
        parameters.push({
            name: h.key,
            in: 'header',
            required: !h.disabled,
            schema: { type: 'string' },
            description: h.description || '',
        });
    });

    return parameters;
};

/**
 * Extracts a plain-object example from a Postman request.body, which is normally
 * wrapped as { mode: 'raw', raw: '<json string>' } and must not be passed through
 * as-is (it would otherwise leak `mode`/`raw` as fake request body fields).
 */
const extractRequestBody = (body) => {
    if (!body || typeof body !== 'object') return undefined;

    if (body.mode === 'raw' && typeof body.raw === 'string') {
        try {
            const parsed = JSON.parse(body.raw);
            return parsed && typeof parsed === 'object' ? parsed : undefined;
        } catch (error) {
            return undefined;
        }
    }

    if (body.mode === 'urlencoded' && Array.isArray(body.urlencoded)) {
        const result = {};
        body.urlencoded.forEach((kv) => {
            if (kv?.key) result[kv.key] = kv.value;
        });
        return result;
    }

    if (body.mode === 'formdata' && Array.isArray(body.formdata)) {
        const result = {};
        body.formdata.forEach((kv) => {
            if (kv?.key) result[kv.key] = kv.value;
        });
        return result;
    }

    return undefined;
};

const requiresAuth = (request) => {
    if (request.auth && typeof request.auth === 'object') return true;
    return (request.header || []).some((h) => h?.key && /^authorization$/i.test(h.key) && !h.disabled);
};

const collectItems = (items = [], collector = []) => {
    items.forEach((item) => {
        if (item.item) {
            collectItems(item.item, collector);
            return;
        }

        if (item.request) {
            collector.push(item);
        }
    });

    return collector;
};

const parsePostman = (content, options = {}) => {
    let collection;

    try {
        collection = JSON.parse(content);
    } catch (error) {
        throw new ApiError(422, `Postman Collection could not be parsed: ${error.message}`, 'PARSE_FAILED');
    }

    const schema = collection.info?.schema;

    if (!schema || !String(schema).toLowerCase().includes('postman')) {
        throw new ApiError(422, 'Postman Collection must contain info.schema with a Postman schema URL', 'PARSE_FAILED');
    }

    const requestItems = collectItems(collection.item || []);
    const endpoints = requestItems.map((item) => {
        const request = item.request || {};
        const url = request.url || {};

        return normalizeEndpoint({
            method: request.method,
            path: normalizePostmanUrl(url),
            parameters: toSwaggerParameters(url.query, request.header),
            headers: request.header || [],
            // bodyIsSynthetic intentionally left at its default (false): unlike
            // the AST parser's generated placeholders, this body is real literal
            // JSON the user typed into their own Postman collection and may
            // contain real credentials, so it must still be secret-redacted.
            requestBody: extractRequestBody(request.body),
            security: requiresAuth(request),
            description: request.description || item.name || '',
            sourceFile: options.sourceFile,
            lineNumber: null,
            raw: {
                name: item.name,
                parser: 'postman',
            },
        });
    });

    return {
        fileType: 'postman',
        endpointCount: endpoints.length,
        endpoints,
        warnings: endpoints.length === 0 ? ['No request items were found in this Postman Collection.'] : [],
    };
};

module.exports = {
    parsePostman,
};

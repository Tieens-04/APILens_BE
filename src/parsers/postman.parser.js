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
            parameters: url.query || [],
            headers: request.header || [],
            body: request.body,
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

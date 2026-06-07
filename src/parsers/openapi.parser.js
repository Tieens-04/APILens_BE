const { normalizeEndpoint } = require('./normalizeEndpoint');
const ApiError = require('../utils/ApiError');

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

const parseJsonSpec = (content) => {
    try {
        return JSON.parse(content);
    } catch (error) {
        return null;
    }
};

const parseYamlPaths = (content, options = {}) => {
    const lines = content.split(/\r?\n/);
    const endpoints = [];
    let insidePaths = false;
    let currentPath = null;

    lines.forEach((line, index) => {
        if (/^paths\s*:\s*$/.test(line)) {
            insidePaths = true;
            return;
        }

        if (!insidePaths) {
            return;
        }

        const pathMatch = line.match(/^\s{2}(["']?\/[^:"']+["']?)\s*:\s*$/);

        if (pathMatch) {
            currentPath = pathMatch[1].replace(/^["']|["']$/g, '');
            return;
        }

        const methodMatch = line.match(/^\s{4}(get|post|put|patch|delete|head|options)\s*:\s*$/i);

        if (currentPath && methodMatch) {
            endpoints.push(normalizeEndpoint({
                method: methodMatch[1],
                path: currentPath,
                sourceFile: options.sourceFile,
                lineNumber: index + 1,
                raw: {
                    parser: 'openapi-yaml-lite',
                },
            }));
        }
    });

    return endpoints;
};

const parseOpenApiObject = (spec, options = {}) => {
    if (!spec || (!spec.openapi && !spec.swagger)) {
        throw new ApiError(422, 'OpenAPI/Swagger spec must contain "openapi" or "swagger"', 'PARSE_FAILED');
    }

    const endpoints = [];

    Object.entries(spec.paths || {}).forEach(([path, pathItem]) => {
        Object.entries(pathItem || {}).forEach(([method, operation]) => {
            if (!HTTP_METHODS.has(method.toLowerCase())) {
                return;
            }

            endpoints.push(normalizeEndpoint({
                method,
                path,
                parameters: [
                    ...(pathItem.parameters || []),
                    ...(operation.parameters || []),
                ],
                responses: operation.responses || {},
                requestBody: operation.requestBody,
                description: operation.summary || operation.description || '',
                sourceFile: options.sourceFile,
                lineNumber: null,
                raw: {
                    operationId: operation.operationId,
                    parser: 'openapi',
                },
            }));
        });
    });

    return endpoints;
};

const parseOpenApi = (content, options = {}) => {
    const jsonSpec = parseJsonSpec(content);
    let endpoints;
    const warnings = [];

    if (jsonSpec) {
        endpoints = parseOpenApiObject(jsonSpec, options);
    } else if (/^\s*(openapi|swagger)\s*:/im.test(content)) {
        endpoints = parseYamlPaths(content, options);
        warnings.push('YAML OpenAPI parsing is currently limited to paths and HTTP methods.');
    } else {
        throw new ApiError(422, 'OpenAPI/Swagger file could not be parsed', 'PARSE_FAILED');
    }

    return {
        fileType: 'openapi',
        endpointCount: endpoints.length,
        endpoints,
        warnings,
    };
};

module.exports = {
    parseOpenApi,
};

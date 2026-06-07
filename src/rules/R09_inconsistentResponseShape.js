const RULES = require('./ruleDefinitions');
const { createSmell } = require('./ruleUtils');

const getSuccessSchema = (endpoint) => {
    const successCode = Object.keys(endpoint.responses || {}).find((statusCode) => Number(statusCode) >= 200 && Number(statusCode) < 300);
    const response = endpoint.responses?.[successCode];
    const content = response?.content || {};
    const jsonContent = content['application/json'] || content['application/*+json'];

    return jsonContent?.schema || response?.schema || null;
};

const getSchemaShape = (schema) => {
    if (!schema) {
        return null;
    }

    if (schema.type === 'array') {
        return 'array';
    }

    if (schema.type === 'object') {
        const properties = Object.keys(schema.properties || {}).sort();

        if (properties.includes('data')) {
            return 'enveloped:data';
        }

        return `object:${properties.join(',')}`;
    }

    if (schema.$ref) {
        return 'ref';
    }

    return schema.type || null;
};

const checkInconsistentResponseShape = (endpoints) => {
    const shapedEndpoints = endpoints
        .map((endpoint) => ({
            endpoint,
            shape: getSchemaShape(getSuccessSchema(endpoint)),
        }))
        .filter((item) => item.shape);

    const uniqueShapes = new Set(shapedEndpoints.map((item) => item.shape));

    if (uniqueShapes.size <= 1) {
        return [];
    }

    return shapedEndpoints.map((item) => createSmell(
        RULES.R09,
        item.endpoint,
        `Success response shape differs across endpoints (${Array.from(uniqueShapes).join(' | ')}).`,
        'Use a consistent response envelope, for example { data, meta, error }, across API endpoints.'
    ));
};

module.exports = checkInconsistentResponseShape;

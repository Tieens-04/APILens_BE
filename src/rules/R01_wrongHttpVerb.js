const RULES = require('./ruleDefinitions');
const { createSmell, getPathSegments } = require('./ruleUtils');

const ACTION_METHODS = {
    create: 'POST',
    add: 'POST',
    delete: 'DELETE',
    remove: 'DELETE',
    update: 'PUT',
    edit: 'PUT',
    patch: 'PATCH',
    get: 'GET',
    list: 'GET',
    search: 'GET',
};

const splitWords = (segment) => segment
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[-_\s]+/)
    .map((word) => word.toLowerCase())
    .filter(Boolean);

const checkWrongHttpVerb = (endpoints) => endpoints.flatMap((endpoint) => {
    const words = getPathSegments(endpoint.path).flatMap(splitWords);
    const matchedAction = words.find((word) => ACTION_METHODS[word]);

    if (!matchedAction) {
        return [];
    }

    const expectedMethod = ACTION_METHODS[matchedAction];
    const compatibleMethods = expectedMethod === 'PUT' ? ['PUT', 'PATCH'] : [expectedMethod];

    if (compatibleMethods.includes(endpoint.method)) {
        return [];
    }

    return [createSmell(
        RULES.R01,
        endpoint,
        `Endpoint path suggests "${matchedAction}" but uses ${endpoint.method}.`,
        `Use ${expectedMethod} for "${matchedAction}" actions, or rename the URL to a resource-oriented path.`
    )];
});

module.exports = checkWrongHttpVerb;

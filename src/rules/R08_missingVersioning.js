const RULES = require('./ruleDefinitions');
const { createSmell } = require('./ruleUtils');

const VERSION_PATTERN = /^\/(?:api\/)?v\d+(?:\/|$)/i;

const checkMissingVersioning = (endpoints) => endpoints.flatMap((endpoint) => {
    if (VERSION_PATTERN.test(endpoint.path)) {
        return [];
    }

    return [createSmell(
        RULES.R08,
        endpoint,
        'Endpoint path does not include an API version segment.',
        'Use a versioned prefix such as /api/v1/users to make future changes easier to manage.'
    )];
});

module.exports = checkMissingVersioning;

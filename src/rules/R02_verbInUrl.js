const RULES = require('./ruleDefinitions');
const { createSmell, getPathSegments } = require('./ruleUtils');

const URL_VERBS = new Set([
    'create',
    'add',
    'delete',
    'remove',
    'update',
    'edit',
    'get',
    'list',
    'search',
    'fetch',
    'submit',
]);

const splitWords = (segment) => segment
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[-_\s]+/)
    .map((word) => word.toLowerCase())
    .filter(Boolean);

const checkVerbInUrl = (endpoints) => endpoints.flatMap((endpoint) => {
    const segments = getPathSegments(endpoint.path);
    const hasVerb = segments.some((segment) => splitWords(segment).some((word) => URL_VERBS.has(word)));

    if (!hasVerb) {
        return [];
    }

    return [createSmell(
        RULES.R02,
        endpoint,
        'URL contains an action verb instead of representing a resource.',
        'Prefer resource-oriented URLs such as /users and express the action with the HTTP method.'
    )];
});

module.exports = checkVerbInUrl;

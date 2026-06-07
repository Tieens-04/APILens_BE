const RULES = require('./ruleDefinitions');
const { createSmell, hasPaginationParam, isCollectionGet } = require('./ruleUtils');

const checkNoPagination = (endpoints) => endpoints.flatMap((endpoint) => {
    if (!isCollectionGet(endpoint) || hasPaginationParam(endpoint)) {
        return [];
    }

    return [createSmell(
        RULES.R05,
        endpoint,
        'Collection GET endpoint does not expose pagination parameters.',
        'Add pagination parameters such as page/limit, offset/limit, or cursor-based pagination.'
    )];
});

module.exports = checkNoPagination;

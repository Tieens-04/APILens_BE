const RULES = require('./ruleDefinitions');
const { createSmell, hasAnyResponseCode } = require('./ruleUtils');

const checkMissingErrorStatus = (endpoints) => endpoints.flatMap((endpoint) => {
    const responseCodes = Object.keys(endpoint.responses || {});

    if (responseCodes.length === 0) {
        return [createSmell(
            RULES.R04,
            endpoint,
            'Endpoint does not document any response status codes.',
            'Document success and error responses, including at least one 4xx or 5xx status code.'
        )];
    }

    const hasErrorCode = hasAnyResponseCode(endpoint, (statusCode) => statusCode >= 400);

    if (hasErrorCode) {
        return [];
    }

    return [createSmell(
        RULES.R04,
        endpoint,
        'Endpoint documents success responses but no error status code.',
        'Add documented error responses such as 400, 401, 404, or 500 where appropriate.'
    )];
});

module.exports = checkMissingErrorStatus;

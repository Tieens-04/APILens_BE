const RULES = require('./ruleDefinitions');
const { createSmell, getDocumentedParamNames, getPathParams } = require('./ruleUtils');

const checkUndocumentedParams = (endpoints) => endpoints.flatMap((endpoint) => {
    const pathParams = getPathParams(endpoint.path);

    if (pathParams.length === 0) {
        return [];
    }

    const documentedParamNames = new Set(getDocumentedParamNames(endpoint));
    const missingParams = pathParams.filter((paramName) => !documentedParamNames.has(paramName));

    if (missingParams.length === 0) {
        return [];
    }

    return [createSmell(
        RULES.R06,
        endpoint,
        `Path parameter(s) are not documented: ${missingParams.join(', ')}.`,
        'Document every path parameter with name, location, type, and meaning.'
    )];
});

module.exports = checkUndocumentedParams;

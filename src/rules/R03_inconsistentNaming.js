const RULES = require('./ruleDefinitions');
const { createSmell, getPathSegments } = require('./ruleUtils');

const getNamingStyle = (segment) => {
    if (/[_]/.test(segment)) {
        return 'snake_case';
    }

    if (/-/.test(segment)) {
        return 'lowercase-resource';
    }

    if (/[A-Z]/.test(segment)) {
        return 'camelCase';
    }

    return 'lowercase-resource';
};

const isParamSegment = (segment) => segment.startsWith(':') || (segment.startsWith('{') && segment.endsWith('}'));

const checkInconsistentNaming = (endpoints) => {
    const endpointStyles = endpoints.map((endpoint) => {
        const styles = getPathSegments(endpoint.path)
            .filter((segment) => !isParamSegment(segment))
            .map(getNamingStyle);

        return {
            endpoint,
            styles,
        };
    });

    const uniqueStyles = new Set(endpointStyles.flatMap((item) => item.styles));

    if (uniqueStyles.size <= 1) {
        return [];
    }

    return endpointStyles
        .filter((item) => item.styles.some((style) => style !== 'lowercase'))
        .map((item) => createSmell(
            RULES.R03,
            item.endpoint,
            `Path naming style is mixed across the API (${Array.from(uniqueStyles).join(', ')}).`,
            'Pick one URL naming convention, preferably lowercase resource names with hyphen only when needed.'
        ));
};

module.exports = checkInconsistentNaming;

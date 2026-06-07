const templates = {
    R01: (smell) => `Review ${smell.endpoints.join(', ')} and align the HTTP method with the action. Use POST for create, DELETE for delete, and PUT/PATCH for update operations.`,
    R02: (smell) => `Rename ${smell.endpoints.join(', ')} to a resource-based URL. For example, use POST /users instead of POST /createUser.`,
    R03: () => 'Choose one URL naming convention across the API, preferably lowercase resource names with hyphens only when a separator is needed.',
    R04: (smell) => `Document error responses for ${smell.endpoints.join(', ')}. Add realistic 4xx/5xx responses such as 400, 401, 404, or 500.`,
    R05: (smell) => `Add pagination to ${smell.endpoints.join(', ')} using page/limit, offset/limit, or cursor parameters.`,
    R06: (smell) => `Document all path and query parameters for ${smell.endpoints.join(', ')}, including name, location, type, required flag, and example value.`,
    R07: () => 'Move hardcoded secrets to environment variables or a secret manager, then rotate any exposed credentials immediately.',
    R08: (smell) => `Add a version prefix to ${smell.endpoints.join(', ')}, such as /api/v1, so future breaking changes can be managed safely.`,
    R09: () => 'Standardize response bodies across endpoints. A simple envelope such as { data, meta, error } makes clients easier to build and test.',
};

const buildFallbackSuggestion = (smell) => {
    const template = templates[smell.ruleId];

    if (template) {
        return template(smell);
    }

    return smell.suggestion || 'Review this API smell and apply RESTful API best practices.';
};

const applyFallbackSuggestions = (smells) => smells.map((smell) => ({
    ...smell,
    suggestion: smell.suggestion || buildFallbackSuggestion(smell),
}));

const buildOverallFallbackSummary = (analysisInput) => {
    const smells = analysisInput.smells || [];

    if (smells.length === 0) {
        return 'No API design smells were detected. Keep response shapes, versioning, and documentation consistent as the API grows.';
    }

    const criticalCount = smells.filter((smell) => smell.severity === 'Critical').length;
    const topRules = [...new Set(smells.slice(0, 5).map((smell) => `${smell.ruleId} ${smell.smellName}`))].join(', ');

    return `Focus first on ${criticalCount} critical issue(s), then address repeated consistency problems. Top findings: ${topRules}.`;
};

module.exports = {
    buildFallbackSuggestion,
    applyFallbackSuggestions,
    buildOverallFallbackSummary,
};

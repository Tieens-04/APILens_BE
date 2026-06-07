const RULES = require('./ruleDefinitions');
const { createSmell } = require('./ruleUtils');

const SECRET_PATTERNS = [
    /\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*['"][^'"]{8,}['"]/i,
    /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/i,
    /\bAKIA[0-9A-Z]{16}\b/,
    /mongodb(?:\+srv)?:\/\/[^:\s]+:[^@\s]+@/i,
];

const checkHardcodedSecrets = (endpoints, context = {}) => {
    const content = context.content || context.sourceContent || '';

    if (!content) {
        return [];
    }

    const lines = content.split(/\r?\n/);
    const matchedLines = [];

    lines.forEach((line, index) => {
        if (SECRET_PATTERNS.some((pattern) => pattern.test(line))) {
            matchedLines.push(index + 1);
        }
    });

    if (matchedLines.length === 0) {
        return [];
    }

    return [createSmell(
        RULES.R07,
        null,
        'Source file appears to contain hardcoded secrets or credentials.',
        'Move secrets to environment variables or a secret manager, then rotate exposed credentials.',
        {
            endpoints: endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`),
            lineNumbers: matchedLines,
        }
    )];
};

module.exports = checkHardcodedSecrets;

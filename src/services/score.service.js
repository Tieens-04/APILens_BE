const RULE_DEFINITIONS = require('../rules/ruleDefinitions');

const CATEGORY_NAMES = [
    'Naming',
    'HTTP Design',
    'Documentation',
    'Security',
    'Response Consistency',
];

const calculateScore = (smells) => {
    const totalPenalty = smells.reduce((sum, smell) => {
        const affectedCount = Math.max(smell.endpoints?.length || 1, 1);

        return sum + smell.weight * affectedCount;
    }, 0);

    return Math.max(0, 100 - totalPenalty);
};

const calculateSeveritySummary = (smells) => smells.reduce(
    (summary, smell) => {
        const key = smell.severity.toLowerCase();
        summary[key] = (summary[key] || 0) + Math.max(smell.endpoints?.length || 1, 1);
        return summary;
    },
    {
        critical: 0,
        medium: 0,
        low: 0,
    }
);

const calculateCategoryScores = (smells) => {
    const categoryPenalties = CATEGORY_NAMES.reduce((scores, category) => {
        scores[category] = 0;
        return scores;
    }, {});

    smells.forEach((smell) => {
        const category = smell.category || RULE_DEFINITIONS[smell.ruleId]?.category;

        if (!category || categoryPenalties[category] === undefined) {
            return;
        }

        categoryPenalties[category] += smell.weight * Math.max(smell.endpoints?.length || 1, 1);
    });

    return CATEGORY_NAMES.reduce((scores, category) => {
        scores[category] = Math.max(0, 100 - categoryPenalties[category]);
        return scores;
    }, {});
};

module.exports = {
    calculateScore,
    calculateSeveritySummary,
    calculateCategoryScores,
};

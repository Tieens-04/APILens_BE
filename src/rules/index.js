const checkWrongHttpVerb = require('./R01_wrongHttpVerb');
const checkVerbInUrl = require('./R02_verbInUrl');
const checkInconsistentNaming = require('./R03_inconsistentNaming');
const checkMissingErrorStatus = require('./R04_missingErrorStatus');
const checkNoPagination = require('./R05_noPagination');
const checkUndocumentedParams = require('./R06_undocumentedParams');
const checkHardcodedSecrets = require('./R07_hardcodedSecrets');
const checkMissingVersioning = require('./R08_missingVersioning');
const checkInconsistentResponseShape = require('./R09_inconsistentResponseShape');
const scoreService = require('../services/score.service');

const ruleChecks = [
    checkWrongHttpVerb,
    checkVerbInUrl,
    checkInconsistentNaming,
    checkMissingErrorStatus,
    checkNoPagination,
    checkUndocumentedParams,
    checkHardcodedSecrets,
    checkMissingVersioning,
    checkInconsistentResponseShape,
];

const runRuleEngine = (endpoints, context = {}) => {
    const smells = ruleChecks.flatMap((ruleCheck) => ruleCheck(endpoints, context));
    const score = scoreService.calculateScore(smells);

    return {
        score,
        endpointCount: endpoints.length,
        smellCount: smells.reduce((sum, smell) => sum + Math.max(smell.endpoints?.length || 1, 1), 0),
        severitySummary: scoreService.calculateSeveritySummary(smells),
        categoryScores: scoreService.calculateCategoryScores(smells),
        smells,
    };
};

module.exports = {
    runRuleEngine,
};

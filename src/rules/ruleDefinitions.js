const RULE_DEFINITIONS = {
    R01: {
        ruleId: 'R01',
        smellName: 'Wrong HTTP Verb',
        severity: 'Critical',
        weight: 15,
        category: 'HTTP Design',
    },
    R02: {
        ruleId: 'R02',
        smellName: 'Verb in URL',
        severity: 'Critical',
        weight: 15,
        category: 'HTTP Design',
    },
    R03: {
        ruleId: 'R03',
        smellName: 'Inconsistent Naming',
        severity: 'Medium',
        weight: 10,
        category: 'Naming',
    },
    R04: {
        ruleId: 'R04',
        smellName: 'Missing Error Status Code',
        severity: 'Critical',
        weight: 15,
        category: 'Documentation',
    },
    R05: {
        ruleId: 'R05',
        smellName: 'No Pagination',
        severity: 'Medium',
        weight: 10,
        category: 'HTTP Design',
    },
    R06: {
        ruleId: 'R06',
        smellName: 'Undocumented Params',
        severity: 'Low',
        weight: 5,
        category: 'Documentation',
    },
    R07: {
        ruleId: 'R07',
        smellName: 'Hardcoded Secrets',
        severity: 'Critical',
        weight: 15,
        category: 'Security',
    },
    R08: {
        ruleId: 'R08',
        smellName: 'Missing Versioning',
        severity: 'Low',
        weight: 5,
        category: 'HTTP Design',
    },
    R09: {
        ruleId: 'R09',
        smellName: 'Inconsistent Response Shape',
        severity: 'Medium',
        weight: 5,
        category: 'Response Consistency',
    },
};

module.exports = RULE_DEFINITIONS;

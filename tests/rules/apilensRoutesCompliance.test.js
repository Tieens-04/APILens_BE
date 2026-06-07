const fs = require('fs');
const path = require('path');
const parserService = require('../../src/services/parser.service');
const { runRuleEngine } = require('../../src/rules');

const routeFiles = [
    'auth.routes.js',
    'repo.routes.js',
    'analysis.routes.js',
    'parser.routes.js',
];

describe('APILens route files compliance', () => {
    test.each(routeFiles)('%s does not trigger documentation or versioning smells', (fileName) => {
        const sourceFile = path.join('src', 'routes', fileName);
        const content = fs.readFileSync(path.join(process.cwd(), sourceFile), 'utf8');
        const parseResult = parserService.parseContent({
            content,
            fileType: 'express',
            sourceFile,
        });
        const ruleResult = runRuleEngine(parseResult.endpoints, {
            content,
            sourceFile,
            fileType: 'express',
        });
        const ruleIds = ruleResult.smells.map((smell) => smell.ruleId);

        expect(ruleIds).not.toContain('R04');
        expect(ruleIds).not.toContain('R08');
    });
});

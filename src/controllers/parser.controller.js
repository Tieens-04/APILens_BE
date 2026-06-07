const asyncHandler = require('../utils/asyncHandler');
const parserService = require('../services/parser.service');
const aiSuggestionService = require('../services/aiSuggestion.service');
const { runRuleEngine } = require('../rules');

const previewParse = asyncHandler(async (req, res) => {
    const { content, fileType, sourceFile } = req.body;
    const result = parserService.parseContent({
        content,
        fileType,
        sourceFile,
    });

    res.status(200).json(result);
});

const previewAnalyze = asyncHandler(async (req, res) => {
    const { content, fileType, sourceFile } = req.body;
    const parseResult = parserService.parseContent({
        content,
        fileType,
        sourceFile,
    });
    const ruleResult = runRuleEngine(parseResult.endpoints, {
        content,
        sourceFile,
        fileType: parseResult.fileType,
    });
    const suggestionResult = await aiSuggestionService.generateSuggestion({
        filePath: sourceFile,
        fileType: parseResult.fileType,
        score: ruleResult.score,
        endpointCount: ruleResult.endpointCount,
        smells: ruleResult.smells,
    });

    res.status(200).json({
        ...parseResult,
        ...ruleResult,
        smells: suggestionResult.smells,
        aiSuggestion: suggestionResult.aiSuggestion,
        warnings: [
            ...(parseResult.warnings || []),
            ...(suggestionResult.warning ? [suggestionResult.warning] : []),
        ],
    });
});

module.exports = {
    previewParse,
    previewAnalyze,
};

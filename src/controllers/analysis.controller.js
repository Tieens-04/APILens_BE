const asyncHandler = require('../utils/asyncHandler');
const parserService = require('../services/parser.service');
const analysisService = require('../services/analysis.service');
const aiSuggestionService = require('../services/aiSuggestion.service');
const { runRuleEngine } = require('../rules');

const normalizeSeverity = (severity) => {
    const value = String(severity || '').toLowerCase();

    if (value === 'critical') {
        return 'critical';
    }

    if (value === 'error') {
        return 'error';
    }

    if (value === 'low' || value === 'info') {
        return 'info';
    }

    return 'warning';
};

const buildSummary = (severitySummary = {}) => ({
    critical: severitySummary.critical || 0,
    warning: (severitySummary.warning || 0) + (severitySummary.medium || 0),
    info: (severitySummary.info || 0) + (severitySummary.low || 0),
});

const mapSmellToIssue = (smell, filePath) => {
    const line = smell.lineNumbers?.[0];

    return {
        rule: smell.ruleId,
        ruleName: smell.smellName,
        severity: normalizeSeverity(smell.severity),
        message: smell.description,
        suggestion: smell.suggestion,
        filePath,
        ...(line ? { line, column: 1 } : {}),
    };
};

const createAnalysis = asyncHandler(async (req, res) => {
    const analysis = await analysisService.runAnalysis(req.user._id, req.body);

    res.status(201).json({
        analysis,
    });
});

const getAnalysis = asyncHandler(async (req, res) => {
    const analysis = await analysisService.getAnalysisById(req.user._id, req.params.id);

    res.status(200).json({
        analysis,
    });
});

const listMyAnalyses = asyncHandler(async (req, res) => {
    const analyses = await analysisService.listUserAnalyses(req.user._id, {
        limit: req.query.limit,
        page: req.query.page,
        repoFullName: req.query.repoFullName,
        branch: req.query.branch,
    });

    res.status(200).json({
        analyses,
    });
});

const deleteAnalysis = asyncHandler(async (req, res) => {
    await analysisService.deleteAnalysis(req.user._id, req.params.id);

    res.status(200).json({
        success: true,
    });
});

const analyzeVSCodeContent = asyncHandler(async (req, res) => {
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
        analysis: {
            filePath: sourceFile,
            fileType: parseResult.fileType,
            status: 'done',
            warnings: [
                ...(parseResult.warnings || []),
                ...(suggestionResult.warning ? [suggestionResult.warning] : []),
            ],
            endpoints: parseResult.endpoints,
            ...ruleResult,
            smells: suggestionResult.smells,
            aiSuggestion: suggestionResult.aiSuggestion,
        },
    });
});

const analyzeFileContent = asyncHandler(async (req, res) => {
    const {
        content,
        fileName,
        filePath,
        fileType,
    } = req.body;
    const sourceFile = filePath || fileName;
    const requestedFileType = fileType === 'unknown' ? undefined : fileType;
    const parseResult = parserService.parseContent({
        content,
        fileType: requestedFileType,
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
        success: true,
        data: {
            score: ruleResult.score,
            summary: buildSummary(ruleResult.severitySummary),
            issues: suggestionResult.smells.map((smell) => mapSmellToIssue(smell, sourceFile)),
            warnings: [
                ...(parseResult.warnings || []),
                ...(suggestionResult.warning ? [suggestionResult.warning] : []),
            ],
            filePath: sourceFile,
            fileType: parseResult.fileType,
            endpointCount: ruleResult.endpointCount,
        },
    });
});

module.exports = {
    createAnalysis,
    getAnalysis,
    listMyAnalyses,
    deleteAnalysis,
    analyzeVSCodeContent,
    analyzeFileContent,
};

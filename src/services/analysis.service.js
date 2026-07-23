const Analysis = require('../models/Analysis.model');
const ApiError = require('../utils/ApiError');
const githubService = require('./github.service');
const parserService = require('./parser.service');
const aiSuggestionService = require('./aiSuggestion.service');
const { runRuleEngine } = require('../rules');
const { emitToUser } = require('./notification.service');

const splitRepoFullName = (repoFullName) => {
    const [owner, repo] = String(repoFullName || '').split('/');

    if (!owner || !repo) {
        throw new ApiError(400, 'repoFullName must use "owner/repo" format', 'VALIDATION_ERROR');
    }

    return {
        owner,
        repo,
    };
};

const sanitizeEndpoint = (endpoint) => {
    const { raw, ...safeEndpoint } = endpoint;

    return safeEndpoint;
};

const creditService = require('./credit.service');

const runAnalysis = async (userId, payload) => {
    const { repoFullName, branch = 'main', filePath, fileType } = payload;

    if (!repoFullName || !filePath) {
        throw new ApiError(400, 'repoFullName and filePath are required', 'VALIDATION_ERROR');
    }

    const { owner, repo } = splitRepoFullName(repoFullName);
    const analysis = await Analysis.create({
        userId,
        repoFullName,
        branch,
        filePath,
        fileType,
        status: 'pending',
    });

    try {
        const content = await githubService.fetchUserRepositoryFileContent(userId, owner, repo, filePath, branch);
        const parseResult = parserService.parseContent({
            content,
            fileType,
            sourceFile: filePath,
        });
        const ruleResult = runRuleEngine(parseResult.endpoints, {
            content,
            sourceFile: filePath,
            fileType: parseResult.fileType,
        });
        const suggestionResult = await aiSuggestionService.generateSuggestion({
            repoFullName,
            branch,
            filePath,
            fileType: parseResult.fileType,
            score: ruleResult.score,
            endpointCount: ruleResult.endpointCount,
            smells: ruleResult.smells,
        });

        await creditService.recordAiUsage(userId, 1650);

        analysis.fileType = parseResult.fileType;
        analysis.status = 'done';
        analysis.score = ruleResult.score;
        analysis.endpointCount = ruleResult.endpointCount;
        analysis.smellCount = ruleResult.smellCount;
        analysis.severitySummary = ruleResult.severitySummary;
        analysis.categoryScores = ruleResult.categoryScores;
        analysis.endpoints = parseResult.endpoints.map(sanitizeEndpoint);
        analysis.smells = suggestionResult.smells;
        analysis.warnings = [
            ...(parseResult.warnings || []),
            ...(suggestionResult.warning ? [suggestionResult.warning] : []),
        ];
        analysis.aiSuggestion = suggestionResult.aiSuggestion;
        analysis.errorMessage = undefined;

        await analysis.save();

        // Notify all tabs of this user that the analysis finished successfully
        emitToUser(userId, 'analysis.updated', {
            analysis: {
                _id: analysis._id,
                repoFullName: analysis.repoFullName,
                branch: analysis.branch,
                filePath: analysis.filePath,
                fileType: analysis.fileType,
                status: analysis.status,
                score: analysis.score,
                smellCount: analysis.smellCount,
                endpointCount: analysis.endpointCount,
                severitySummary: analysis.severitySummary,
                createdAt: analysis.createdAt,
                updatedAt: analysis.updatedAt,
            },
        });

        return analysis;
    } catch (error) {
        analysis.status = 'failed';
        analysis.errorMessage = error.message;
        await analysis.save();

        // Notify tabs that the analysis failed so UI can show error state
        emitToUser(userId, 'analysis.updated', {
            analysis: {
                _id: analysis._id,
                repoFullName: analysis.repoFullName,
                status: 'failed',
                errorMessage: error.message,
            },
        });

        throw error;
    }
};

const getAnalysisById = async (userId, analysisId) => {
    const analysis = await Analysis.findOne({
        _id: analysisId,
        userId,
    });

    if (!analysis) {
        throw new ApiError(404, 'Analysis not found', 'ANALYSIS_NOT_FOUND');
    }

    return analysis;
};

const listUserAnalyses = async (userId, options = {}) => {
    const limit = Math.min(Number(options.limit) || 20, 50);
    const page = Math.max(Number(options.page) || 1, 1);
    const query = {
        userId,
    };

    if (options.repoFullName) {
        query.repoFullName = options.repoFullName;
    }

    if (options.branch) {
        query.branch = options.branch;
    }

    return Analysis.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
};

const deleteAnalysis = async (userId, analysisId) => {
    const analysis = await Analysis.findOneAndDelete({
        _id: analysisId,
        userId,
    });

    if (!analysis) {
        throw new ApiError(404, 'Analysis not found', 'ANALYSIS_NOT_FOUND');
    }

    return analysis;
};

const rerunAnalysis = async (userId, analysisId) => {
    const analysis = await getAnalysisById(userId, analysisId);

    return runAnalysis(userId, {
        repoFullName: analysis.repoFullName,
        branch: analysis.branch,
        filePath: analysis.filePath,
        fileType: analysis.fileType,
    });
};

module.exports = {
    runAnalysis,
    rerunAnalysis,
    getAnalysisById,
    listUserAnalyses,
    deleteAnalysis,
};

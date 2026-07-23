const asyncHandler = require('../utils/asyncHandler');
const parserService = require('../services/parser.service');
const analysisService = require('../services/analysis.service');
const aiSuggestionService = require('../services/aiSuggestion.service');
const githubService = require('../services/github.service');
const aiFixService = require('../services/aiFix.service');
const creditService = require('../services/credit.service');
const ApiError = require('../utils/ApiError');
const { runRuleEngine } = require('../rules');
const PDFDocument = require('pdfkit');
const { emitToUser } = require('../services/notification.service');

const createAnalysis = asyncHandler(async (req, res) => {
    await creditService.checkAndDeductCredits(req.user._id, 'SCAN');
    const analysis = await analysisService.runAnalysis(req.user._id, req.body);

    // Notify the user's browser tabs that a new analysis is available
    emitToUser(req.user._id, 'analysis.created', {
        analysis: {
            _id: analysis._id,
            repoFullName: analysis.repoFullName,
            branch: analysis.branch,
            filePath: analysis.filePath,
            status: analysis.status,
            score: analysis.score,
            smellCount: analysis.smellCount,
            endpointCount: analysis.endpointCount,
            severitySummary: analysis.severitySummary,
            createdAt: analysis.createdAt,
        },
    });

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

    // Notify other tabs that this analysis has been removed
    emitToUser(req.user._id, 'analysis.deleted', {
        analysisId: req.params.id,
    });

    res.status(200).json({
        success: true,
    });
});

const rerunAnalysis = asyncHandler(async (req, res) => {
    await creditService.checkAndDeductCredits(req.user._id, 'SCAN');
    const analysis = await analysisService.rerunAnalysis(req.user._id, req.params.id);

    // Rerun creates a fresh analysis — notify as created
    emitToUser(req.user._id, 'analysis.created', {
        analysis: {
            _id: analysis._id,
            repoFullName: analysis.repoFullName,
            branch: analysis.branch,
            filePath: analysis.filePath,
            status: analysis.status,
            score: analysis.score,
            smellCount: analysis.smellCount,
            endpointCount: analysis.endpointCount,
            severitySummary: analysis.severitySummary,
            createdAt: analysis.createdAt,
        },
    });

    res.status(201).json({
        analysis,
    });
});

const safeFileName = (value) => String(value || 'apilens-report')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const drawKeyValue = (doc, label, value) => {
    doc
        .fontSize(9)
        .fillColor('#6b7280')
        .text(label.toUpperCase(), { continued: true })
        .fillColor('#111827')
        .text(`  ${value ?? '-'}`);
};

const writePdfReport = (analysis, res) => {
    const doc = new PDFDocument({
        margin: 48,
        size: 'A4',
        bufferPages: true,
    });

    doc.pipe(res);

    doc
        .fillColor('#111827')
        .fontSize(22)
        .text('APILens Endpoint Integrity Report', { align: 'left' });

    doc.moveDown(0.4);
    doc
        .fontSize(10)
        .fillColor('#4b5563')
        .text(`${analysis.repoFullName} - ${analysis.branch} - ${analysis.filePath}`);

    doc.moveDown();
    drawKeyValue(doc, 'Score', analysis.score);
    drawKeyValue(doc, 'Status', analysis.status);
    drawKeyValue(doc, 'Endpoints', analysis.endpointCount);
    drawKeyValue(doc, 'Smells', analysis.smellCount);
    drawKeyValue(doc, 'Created', analysis.createdAt?.toISOString?.() || analysis.createdAt);

    doc.moveDown();
    doc
        .fontSize(14)
        .fillColor('#111827')
        .text('Severity Summary');
    doc.moveDown(0.3);
    drawKeyValue(doc, 'Critical', analysis.severitySummary?.critical || 0);
    drawKeyValue(doc, 'Medium', analysis.severitySummary?.medium || 0);
    drawKeyValue(doc, 'Low', analysis.severitySummary?.low || 0);

    const categoryScores = analysis.categoryScores instanceof Map
        ? Object.fromEntries(analysis.categoryScores)
        : (analysis.categoryScores || {});

    if (Object.keys(categoryScores).length > 0) {
        doc.moveDown();
        doc
            .fontSize(14)
            .fillColor('#111827')
            .text('Category Scores');
        doc.moveDown(0.3);
        Object.entries(categoryScores).forEach(([category, score]) => {
            drawKeyValue(doc, category, score);
        });
    }

    doc.moveDown();
    doc
        .fontSize(14)
        .fillColor('#111827')
        .text('Detected Issues');
    doc.moveDown(0.3);

    if (!analysis.smells?.length) {
        doc.fontSize(10).fillColor('#4b5563').text('No API design smells were detected.');
    } else {
        analysis.smells.forEach((smell, index) => {
            doc
                .fontSize(11)
                .fillColor('#111827')
                .text(`${index + 1}. [${smell.severity}] ${smell.smellName}`);
            doc
                .fontSize(9)
                .fillColor('#4b5563')
                .text(smell.description || 'No description.');
            if (smell.suggestion) {
                doc
                    .fontSize(9)
                    .fillColor('#374151')
                    .text(`Suggestion: ${smell.suggestion}`);
            }
            doc.moveDown(0.5);
        });
    }

    doc.moveDown();
    doc
        .fontSize(14)
        .fillColor('#111827')
        .text('AI Remediation Plan');
    doc.moveDown(0.3);
    doc
        .fontSize(10)
        .fillColor('#374151')
        .text(analysis.aiSuggestion || 'No remediation plan is required.', {
            align: 'left',
        });

    doc.end();
};

const exportAnalysis = asyncHandler(async (req, res) => {
    const analysis = await analysisService.getAnalysisById(req.user._id, req.params.id);
    const format = String(req.query.format || 'json').toLowerCase();
    const baseName = safeFileName(`${analysis.repoFullName}-${analysis.filePath}`) || 'apilens-report';

    if (format === 'json') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.json"`);
        res.status(200).send(JSON.stringify(analysis.toObject({ flattenMaps: true }), null, 2));
        return;
    }

    if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);
        writePdfReport(analysis, res);
        return;
    }

    throw new ApiError(400, 'format must be one of: json, pdf', 'VALIDATION_ERROR');
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

const generateFix = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { smellIndex } = req.body;

    if (smellIndex === undefined) {
        throw new ApiError(400, 'smellIndex is required', 'VALIDATION_ERROR');
    }

    await creditService.checkAndDeductCredits(req.user._id, 'AI_FIX');

    const analysis = await analysisService.getAnalysisById(req.user._id, id);
    if (!analysis) {
        throw new ApiError(404, 'Analysis not found', 'NOT_FOUND');
    }

    const smell = analysis.smells[smellIndex];
    if (!smell) {
        throw new ApiError(404, 'Smell not found at specified index', 'NOT_FOUND');
    }

    const accessToken = await githubService.getGithubAccessToken(req.user._id);
    const { owner, repo } = githubService.parseGithubRepoUrl(analysis.repoFullName);

    // Fetch the original file content from GitHub
    const originalContent = await githubService.fetchRepositoryFileContent(
        accessToken,
        owner,
        repo,
        analysis.filePath,
        analysis.branch
    );

    // Generate the AI code fix
    const fixedContent = await aiFixService.generateFix({
        content: originalContent,
        fileType: analysis.fileType,
        filePath: analysis.filePath,
        smell,
    });

    await creditService.recordAiUsage(req.user._id, 1850);

    res.status(200).json({
        success: true,
        originalContent,
        fixedContent,
        filePath: analysis.filePath,
        smellIndex,
    });
});

const createPullRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { smellIndex, fixedContent } = req.body;

    if (smellIndex === undefined || !fixedContent) {
        throw new ApiError(400, 'smellIndex and fixedContent are required', 'VALIDATION_ERROR');
    }

    await creditService.checkAndDeductCredits(req.user._id, 'CREATE_PR');

    const analysis = await analysisService.getAnalysisById(req.user._id, id);
    if (!analysis) {
        throw new ApiError(404, 'Analysis not found', 'NOT_FOUND');
    }

    const smell = analysis.smells[smellIndex];
    if (!smell) {
        throw new ApiError(404, 'Smell not found at specified index', 'NOT_FOUND');
    }

    const accessToken = await githubService.getGithubAccessToken(req.user._id);
    const { owner, repo } = githubService.parseGithubRepoUrl(analysis.repoFullName);

    // 1. Get base branch SHA
    const baseBranchName = analysis.branch || 'main';
    const refPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(baseBranchName)}`;
    const baseRef = await githubService.githubFetch(accessToken, refPath);
    const baseSha = baseRef.payload?.object?.sha;

    if (!baseSha) {
        throw new ApiError(500, 'Failed to retrieve branch reference from GitHub', 'GITHUB_API_ERROR');
    }

    // 2. Create a new branch pointing to baseSha
    const newBranchName = `apilens-fix-${smell.ruleId || 'smell'}-${Date.now()}`;
    const createBranchPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`;
    await githubService.githubFetch(accessToken, createBranchPath, {
        method: 'POST',
        body: JSON.stringify({
            ref: `refs/heads/${newBranchName}`,
            sha: baseSha,
        }),
    });

    // 3. Get file SHA from the new branch to prepare for commit
    const encodedFilePath = analysis.filePath.split('/').map(encodeURIComponent).join('/');
    const contentPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedFilePath}?ref=${newBranchName}`;
    const fileContentResult = await githubService.githubFetch(accessToken, contentPath);
    const fileSha = fileContentResult.payload?.sha;

    if (!fileSha) {
        throw new ApiError(500, 'Failed to retrieve file reference from GitHub', 'GITHUB_API_ERROR');
    }

    // 4. Commit updated content (PUT /repos/:owner/:repo/contents/:path)
    const commitMessage = `fix(api): fix REST API design smell (${smell.ruleId} - ${smell.smellName})`;
    const updateContentPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedFilePath}`;
    await githubService.githubFetch(accessToken, updateContentPath, {
        method: 'PUT',
        body: JSON.stringify({
            message: commitMessage,
            content: Buffer.from(fixedContent).toString('base64'),
            sha: fileSha,
            branch: newBranchName,
        }),
    });

    // 5. Create Pull Request (POST /repos/:owner/:repo/pulls)
    const prTitle = `fix(api): fix REST API design smell: ${smell.smellName}`;
    const prBody = [
        '### APILens Auto-Remediation',
        '',
        `This Pull Request was generated by APILens to fix a REST API design smell in **${analysis.filePath}**.`,
        '',
        `- **Rule**: [${smell.ruleId}] ${smell.smellName}`,
        `- **Description**: ${smell.description}`,
        `- **Suggestion**: ${smell.suggestion}`,
        `- **Affected Endpoints**: \`${smell.endpoints?.join('`, `') || 'N/A'}\``,
        `- **Severity**: **${smell.severity}**`,
        '',
        'Please review the changes and merge if they meet your quality standards.',
    ].join('\n');

    const prPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`;
    const prResult = await githubService.githubFetch(accessToken, prPath, {
        method: 'POST',
        body: JSON.stringify({
            title: prTitle,
            body: prBody,
            head: newBranchName,
            base: baseBranchName,
        }),
    });

    const pullRequestUrl = prResult.payload?.html_url;

    if (!pullRequestUrl) {
        throw new ApiError(500, 'Failed to create Pull Request on GitHub', 'GITHUB_API_ERROR');
    }

    res.status(200).json({
        success: true,
        pullRequestUrl,
        branch: newBranchName,
    });
});

module.exports = {
    createAnalysis,
    getAnalysis,
    listMyAnalyses,
    deleteAnalysis,
    rerunAnalysis,
    exportAnalysis,
    analyzeVSCodeContent,
    generateFix,
    createPullRequest,
};

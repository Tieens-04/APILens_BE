const asyncHandler = require('../utils/asyncHandler');
const parserService = require('../services/parser.service');
const analysisService = require('../services/analysis.service');
const aiSuggestionService = require('../services/aiSuggestion.service');
const ApiError = require('../utils/ApiError');
const { runRuleEngine } = require('../rules');
const PDFDocument = require('pdfkit');

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

const rerunAnalysis = asyncHandler(async (req, res) => {
    const analysis = await analysisService.rerunAnalysis(req.user._id, req.params.id);

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

module.exports = {
    createAnalysis,
    getAnalysis,
    listMyAnalyses,
    deleteAnalysis,
    rerunAnalysis,
    exportAnalysis,
    analyzeVSCodeContent,
};

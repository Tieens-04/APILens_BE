const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Analysis = require('../models/Analysis.model');
const { generateOpenApiSpec } = require('../services/swaggerGenerator.service');
const { parseExpressAst } = require('../parsers/expressAst.parser');

/**
 * Controller to generate OpenAPI 3.0 Swagger spec on demand.
 * Protected by requirePremium middleware.
 */
const generateSwaggerSpec = asyncHandler(async (req, res) => {
    const { analysisId, code, endpoints: customEndpoints, serverUrl } = req.body;
    let endpointsToSpec = [];
    let title = 'API Specification';
    let description = 'Generated OpenAPI 3.0 specification';

    if (analysisId) {
        const analysis = await Analysis.findOne({ _id: analysisId, userId: req.user._id });
        if (!analysis) {
            throw new ApiError(404, 'Analysis record not found', 'ANALYSIS_NOT_FOUND');
        }
        endpointsToSpec = analysis.endpoints || [];
        title = `${analysis.repoFullName} - ${analysis.filePath}`;
        description = `APILens Swagger spec for branch ${analysis.branch}`;
    } else if (Array.isArray(customEndpoints) && customEndpoints.length > 0) {
        endpointsToSpec = customEndpoints;
    } else if (code && typeof code === 'string') {
        const parseResult = parseExpressAst(code, { sourceFile: 'fixedCode.js' });
        endpointsToSpec = parseResult.endpoints || [];
        description = 'APILens Swagger spec generated from fixed source code';
    } else {
        throw new ApiError(400, 'Either analysisId, endpoints array, or code string must be provided', 'INVALID_INPUT');
    }

    const openApiSpec = generateOpenApiSpec({
        title,
        description,
        endpoints: endpointsToSpec,
        serverUrl: serverUrl || 'http://localhost:5000',
    });

    res.status(200).json({
        success: true,
        spec: openApiSpec,
    });
});

const { executeInSandbox } = require('../services/swaggerExecutor.service');

/**
 * Controller to execute endpoint code in Sandboxed Node VM environment.
 * Protected by requirePremium middleware.
 */
const executeSwaggerEndpoint = asyncHandler(async (req, res) => {
    const { code, method = 'GET', path = '/', body = {}, headers = {}, query = {} } = req.body;

    const result = await executeInSandbox({
        code: code || '',
        method,
        path,
        body,
        headers,
        query,
    });

    res.status(200).json({
        success: true,
        result,
    });
});

module.exports = {
    generateSwaggerSpec,
    executeSwaggerEndpoint,
};


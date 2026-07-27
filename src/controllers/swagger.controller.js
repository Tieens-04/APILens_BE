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
    const { analysisId, code, endpoints: customEndpoints, serverUrl, repoFullName, branch, filePath } = req.body;
    let endpointsToSpec = [];
    let title = 'API Specification';
    let description = 'Generated OpenAPI 3.0 specification';

    // Tie the generated spec/Postman collection to the repo it came from whenever
    // that context is available, instead of a generic title - a collection named
    // "API Specification" gives no clue which repo/branch/file it was for once
    // exported and opened later in Postman.
    if (repoFullName) {
        title = filePath ? `${repoFullName} - ${filePath}` : repoFullName;
        description = branch
            ? `APILens Swagger spec for ${repoFullName} (branch ${branch})`
            : `APILens Swagger spec for ${repoFullName}`;
    }

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
        const parseResult = parseExpressAst(code, { sourceFile: filePath || 'fixedCode.js' });
        endpointsToSpec = parseResult.endpoints || [];
        if (!repoFullName) {
            description = 'APILens Swagger spec generated from fixed source code';
        }
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

const { convertOpenApiToPostman } = require('../services/postmanExporter.service');

/**
 * Controller to convert OpenAPI spec to Postman Collection v2.1.0 format.
 * Protected by requirePremium middleware.
 */
const exportPostmanCollection = asyncHandler(async (req, res) => {
    const { spec } = req.body;
    if (!spec || typeof spec !== 'object') {
        throw new ApiError(400, 'OpenAPI Spec object is required', 'INVALID_SPEC');
    }

    const postmanCollection = convertOpenApiToPostman(spec);

    res.status(200).json({
        success: true,
        collection: postmanCollection,
    });
});

module.exports = {
    generateSwaggerSpec,
    exportPostmanCollection,
};



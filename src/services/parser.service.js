const ApiError = require('../utils/ApiError');
const { parseExpressAst } = require('../parsers/expressAst.parser');
const { parseOpenApi } = require('../parsers/openapi.parser');
const { parsePostman } = require('../parsers/postman.parser');

const detectFileType = (content, sourceFile = '') => {
    const lowerSourceFile = sourceFile.toLowerCase();

    if (
        lowerSourceFile.endsWith('.js')
        && /\b(router|app|[A-Za-z0-9_]+Router)\s*\.\s*(get|post|put|patch|delete|route|use)\s*\(/i.test(content)
    ) {
        return 'express';
    }

    if ((lowerSourceFile.endsWith('.yaml') || lowerSourceFile.endsWith('.yml')) && /^\s*(openapi|swagger)\s*:/im.test(content)) {
        return 'openapi';
    }

    if (lowerSourceFile.endsWith('.json')) {
        try {
            const parsed = JSON.parse(content);

            if (parsed.openapi || parsed.swagger) {
                return 'openapi';
            }

            if (typeof parsed.info?.schema === 'string' && parsed.info.schema.toLowerCase().includes('postman')) {
                return 'postman';
            }
        } catch (error) {
            return null;
        }
    }

    return null;
};

const parseContent = ({ content, fileType, sourceFile }) => {
    if (!content || typeof content !== 'string') {
        throw new ApiError(400, 'File content is required', 'VALIDATION_ERROR');
    }

    const resolvedFileType = fileType || detectFileType(content, sourceFile);

    if (!resolvedFileType) {
        throw new ApiError(400, 'Unable to detect supported file type', 'INVALID_FILE_TYPE');
    }

    if (resolvedFileType === 'express') {
        return parseExpressAst(content, { sourceFile });
    }

    if (resolvedFileType === 'openapi') {
        return parseOpenApi(content, { sourceFile });
    }

    if (resolvedFileType === 'postman') {
        return parsePostman(content, { sourceFile });
    }

    throw new ApiError(400, `Unsupported file type: ${resolvedFileType}`, 'INVALID_FILE_TYPE');
};

module.exports = {
    detectFileType,
    parseContent,
};

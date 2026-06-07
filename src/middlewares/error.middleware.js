const ApiError = require('../utils/ApiError');

const notFound = (req, res, next) => {
    next(new ApiError(404, `Route ${req.originalUrl} not found`, 'NOT_FOUND'));
};

const errorHandler = (error, req, res, next) => {
    const statusCode = error.statusCode || 500;
    const code = error.code || 'INTERNAL_SERVER_ERROR';

    if (process.env.NODE_ENV !== 'test') {
        console.error(`[ERROR] ${code}: ${error.message}`);
    }

    res.status(statusCode).json({
        error: {
            code,
            message: error.message || 'Internal server error',
            status: statusCode,
        },
    });
};

module.exports = {
    notFound,
    errorHandler,
};

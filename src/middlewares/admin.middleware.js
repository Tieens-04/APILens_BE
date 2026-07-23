const ApiError = require('../utils/ApiError');

const requireAdmin = (req, res, next) => {
    const githubUsername = String(req.user?.providers?.github?.username || '').toLowerCase();
    const name = String(req.user?.name || '').toLowerCase();
    const email = String(req.user?.email || '').toLowerCase();

    const isMitSuu = githubUsername === 'mit-suu' || name.includes('mit-suu') || email.includes('mit-suu');
    const isAdminRole = req.user?.role === 'admin';

    if (!req.user || (!isMitSuu && !isAdminRole)) {
        return next(new ApiError(403, 'Access denied. Only mit-suu or admin role allowed.', 'FORBIDDEN'));
    }

    next();
};

module.exports = {
    requireAdmin,
};

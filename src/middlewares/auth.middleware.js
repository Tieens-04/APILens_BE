const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        throw new ApiError(401, 'Authentication token is required', 'UNAUTHORIZED');
    }

    let payload;

    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw new ApiError(401, 'Authentication token is invalid or expired', 'UNAUTHORIZED');
    }

    const user = await User.findById(payload.sub);

    if (!user) {
        throw new ApiError(401, 'User no longer exists', 'UNAUTHORIZED');
    }

    req.user = user;
    next();
});

const requirePremium = (req, res, next) => {
    if (!req.user || req.user.plan === 'free') {
        throw new ApiError(403, 'This feature requires a Pro or Enterprise plan', 'PREMIUM_REQUIRED');
    }
    next();
};

module.exports = {
    protect,
    requirePremium,
};


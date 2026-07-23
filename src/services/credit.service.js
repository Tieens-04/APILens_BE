const User = require('../models/User.model');
const ApiError = require('../utils/ApiError');

const CREDIT_COSTS = {
    SCAN: 10,
    AI_FIX: 50,
    CREATE_PR: 20,
};

/**
 * Checks if user has enough credits, deducts them, and saves the user.
 * Throws 402 HTTP error if credits are insufficient.
 */
const checkAndDeductCredits = async (userId, actionType) => {
    const cost = CREDIT_COSTS[actionType] || 10;
    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, 'User not found', 'NOT_FOUND');
    }

    const currentCredits = user.credits !== undefined ? user.credits : 500;

    if (currentCredits < cost) {
        throw new ApiError(
            402,
            `Insufficient credits (${currentCredits}/${cost} required for this action). Please upgrade to Pro plan (10,000 VND) to receive 20,000 credits.`,
            'INSUFFICIENT_CREDITS'
        );
    }

    user.credits = currentCredits - cost;
    await user.save();

    return user.credits;
};

/**
 * Records actual AI call count, token count, and estimated cost in USD.
 */
const recordAiUsage = async (userId, tokens = 1750) => {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        user.aiCallsCount = (user.aiCallsCount || 0) + 1;
        user.totalAiTokens = (user.totalAiTokens || 0) + tokens;
        user.totalAiCostUsd = Number((user.totalAiTokens * 0.0000015).toFixed(4));
        await user.save();
    } catch (e) {
        console.error('Failed to record AI usage:', e);
    }
};

module.exports = {
    CREDIT_COSTS,
    checkAndDeductCredits,
    recordAiUsage,
};

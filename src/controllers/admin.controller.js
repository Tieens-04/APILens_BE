const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User.model');
const Analysis = require('../models/Analysis.model');
const Order = require('../models/Order.model');
const ApiError = require('../utils/ApiError');
const { emitToUser, emitToAdmin } = require('../services/notification.service');

const getSystemStats = asyncHandler(async (req, res) => {
    const totalUsers = await User.countDocuments();
    const totalAnalyses = await Analysis.countDocuments();
    
    const analysisAggregation = await Analysis.aggregate([
        {
            $group: {
                _id: null,
                totalIssues: { $sum: '$smellCount' },
                avgScore: { $avg: '$score' },
            },
        },
    ]);

    const revenueAggregation = await Order.aggregate([
        { $match: { status: 'paid' } },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$amount' },
                paidCount: { $sum: 1 },
            },
        },
    ]);

    const stats = {
        totalUsers,
        totalAnalyses,
        totalIssues: analysisAggregation[0]?.totalIssues || 0,
        averageScore: Math.round(analysisAggregation[0]?.avgScore || 0),
        totalRevenue: revenueAggregation[0]?.totalRevenue || 0,
        paidOrdersCount: revenueAggregation[0]?.paidCount || 0,
        totalAiRequests: totalAnalyses * 2,
        estimatedTokens: totalAnalyses * 3500,
        estimatedCostUsd: Number((totalAnalyses * 0.005).toFixed(2)),
    };

    res.status(200).json({
        success: true,
        stats,
    });
});

const getUsersList = asyncHandler(async (req, res) => {
    const users = await User.find().sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        users: users.map((u) => u.toAuthJSON()),
    });
});

const updateUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { role, plan } = req.body;

    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, 'User not found', 'NOT_FOUND');
    }

    if (role && ['user', 'admin'].includes(role)) {
        user.role = role;
    }

    if (plan && ['free', 'pro', 'enterprise'].includes(plan)) {
        user.plan = plan;
        if (plan === 'pro') {
            user.credits = 20000;
            user.maxCredits = 20000;
            const expires = new Date();
            expires.setDate(expires.getDate() + 30);
            user.planExpiresAt = expires;
        } else if (plan === 'enterprise') {
            user.credits = 999999;
            user.maxCredits = 999999;
            const expires = new Date();
            expires.setDate(expires.getDate() + 30);
            user.planExpiresAt = expires;
        } else {
            user.credits = 500;
            user.maxCredits = 500;
            user.planExpiresAt = undefined;
        }
    }

    await user.save();

    // Notify the affected user's tabs AND all admin tabs
    emitToUser(userId, 'user.updated', {
        userId,
        role: user.role,
        plan: user.plan,
        credits: user.credits,
        maxCredits: user.maxCredits,
        planExpiresAt: user.planExpiresAt,
        updatedBy: req.user._id,
    });
    emitToAdmin('user.updated', {
        userId,
        role: user.role,
        plan: user.plan,
        updatedBy: req.user._id,
    });

    res.status(200).json({
        success: true,
        user: user.toAuthJSON(),
    });
});

const deleteUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, 'User not found', 'NOT_FOUND');
    }

    await User.findByIdAndDelete(userId);

    // Notify all admins that a user was deleted
    emitToAdmin('user.deleted', {
        userId,
        deletedBy: req.user._id,
    });

    res.status(200).json({
        success: true,
        message: 'User deleted successfully',
    });
});

const getAllOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find().populate('userId', 'name email avatarUrl providers').sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        orders,
    });
});

module.exports = {
    getSystemStats,
    getUsersList,
    updateUser,
    deleteUser,
    getAllOrders,
};

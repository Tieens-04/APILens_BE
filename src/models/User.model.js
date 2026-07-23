const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true,
            maxlength: 100,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            sparse: true,
            unique: true,
            index: true,
        },
        avatarUrl: {
            type: String,
            trim: true,
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },
        plan: {
            type: String,
            enum: ['free', 'pro', 'enterprise'],
            default: 'free',
        },
        credits: {
            type: Number,
            default: 500,
        },
        maxCredits: {
            type: Number,
            default: 500,
        },
        aiCallsCount: {
            type: Number,
            default: 0,
        },
        totalAiTokens: {
            type: Number,
            default: 0,
        },
        totalAiCostUsd: {
            type: Number,
            default: 0,
        },
        planExpiresAt: {
            type: Date,
        },
        providers: {
            github: {
                id: {
                    type: String,
                    sparse: true,
                    unique: true,
                    index: true,
                },
                username: String,
                accessToken: {
                    type: String,
                    select: false,
                },
            },
        },
    },
    {
        timestamps: true,
    }
);

userSchema.methods.toAuthJSON = function toAuthJSON() {
    const githubUsername = this.providers?.github?.username || '';

    return {
        id: this._id,
        name: this.name,
        email: this.email,
        avatarUrl: this.avatarUrl,
        role: this.role,
        plan: this.plan || 'free',
        credits: this.credits !== undefined ? this.credits : 500,
        maxCredits: this.maxCredits !== undefined ? this.maxCredits : 500,
        aiCallsCount: this.aiCallsCount || 0,
        totalAiTokens: this.totalAiTokens || 0,
        totalAiCostUsd: this.totalAiCostUsd || 0,
        planExpiresAt: this.planExpiresAt,
        providers: {
            github: Boolean(this.providers?.github?.id),
            username: githubUsername,
        },
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
    };
};

module.exports = mongoose.model('User', userSchema);

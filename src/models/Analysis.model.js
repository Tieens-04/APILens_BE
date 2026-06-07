const mongoose = require('mongoose');

const endpointSchema = new mongoose.Schema(
    {
        method: String,
        path: String,
        parameters: {
            type: mongoose.Schema.Types.Mixed,
            default: [],
        },
        responses: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        requestBody: mongoose.Schema.Types.Mixed,
        headers: {
            type: mongoose.Schema.Types.Mixed,
            default: [],
        },
        body: mongoose.Schema.Types.Mixed,
        description: String,
        sourceFile: String,
        lineNumber: Number,
    },
    {
        _id: false,
    }
);

const smellSchema = new mongoose.Schema(
    {
        ruleId: String,
        smellName: String,
        severity: {
            type: String,
            enum: ['Critical', 'Medium', 'Low'],
        },
        weight: Number,
        category: String,
        endpoints: {
            type: [String],
            default: [],
        },
        lineNumbers: {
            type: [Number],
            default: [],
        },
        description: String,
        suggestion: String,
    },
    {
        _id: false,
    }
);

const analysisSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        repoFullName: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        branch: {
            type: String,
            required: true,
            trim: true,
            default: 'main',
        },
        filePath: {
            type: String,
            required: true,
            trim: true,
        },
        fileType: {
            type: String,
            enum: ['openapi', 'postman', 'express'],
        },
        status: {
            type: String,
            enum: ['pending', 'done', 'failed'],
            default: 'pending',
            index: true,
        },
        score: {
            type: Number,
            default: 0,
        },
        endpointCount: {
            type: Number,
            default: 0,
        },
        smellCount: {
            type: Number,
            default: 0,
        },
        severitySummary: {
            critical: {
                type: Number,
                default: 0,
            },
            medium: {
                type: Number,
                default: 0,
            },
            low: {
                type: Number,
                default: 0,
            },
        },
        categoryScores: {
            type: Map,
            of: Number,
            default: {},
        },
        endpoints: {
            type: [endpointSchema],
            default: [],
        },
        smells: {
            type: [smellSchema],
            default: [],
        },
        warnings: {
            type: [String],
            default: [],
        },
        aiSuggestion: {
            type: String,
            default: '',
        },
        errorMessage: String,
    },
    {
        timestamps: true,
    }
);

analysisSchema.index({ userId: 1, createdAt: -1 });
analysisSchema.index({ repoFullName: 1, branch: 1 });

module.exports = mongoose.model('Analysis', analysisSchema);

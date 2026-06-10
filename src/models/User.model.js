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
    return {
        id: this._id,
        name: this.name,
        email: this.email,
        avatarUrl: this.avatarUrl,
        role: this.role,
        providers: {
            github: Boolean(this.providers?.github?.id),
        },
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
    };
};

module.exports = mongoose.model('User', userSchema);

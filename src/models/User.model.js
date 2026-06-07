const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
        password: {
            type: String,
            select: false,
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
            local: {
                type: Boolean,
                default: false,
            },
            google: {
                id: {
                    type: String,
                    sparse: true,
                    unique: true,
                    index: true,
                },
            },
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

userSchema.pre('save', async function hashPassword() {
    if (!this.isModified('password') || !this.password) {
        return;
    }

    this.password = await bcrypt.hash(this.password, 12);
    this.providers.local = true;
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toAuthJSON = function toAuthJSON() {
    return {
        id: this._id,
        name: this.name,
        email: this.email,
        avatarUrl: this.avatarUrl,
        role: this.role,
        providers: {
            local: Boolean(this.providers?.local),
            google: Boolean(this.providers?.google?.id),
            github: Boolean(this.providers?.github?.id),
        },
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
    };
};

module.exports = mongoose.model('User', userSchema);

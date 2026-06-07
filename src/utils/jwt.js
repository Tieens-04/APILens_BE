const jwt = require('jsonwebtoken');

const signAuthToken = (user) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is missing in .env');
    }

    return jwt.sign(
        {
            sub: user._id.toString(),
            email: user.email,
            role: user.role,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        }
    );
};

module.exports = {
    signAuthToken,
};

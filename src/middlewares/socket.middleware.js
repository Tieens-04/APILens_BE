const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

/**
 * Socket.IO authentication middleware.
 *
 * Reads the JWT from `socket.handshake.auth.token`, verifies it,
 * loads the user from MongoDB, and attaches it to `socket.user`.
 *
 * The client must pass the token like:
 *   socket = io(URL, { auth: { token: '<jwt>' } })
 *
 * @param {import('socket.io').Socket} socket
 * @param {Function} next
 */
const socketAuthMiddleware = async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error('Authentication token is required'));
        }

        let payload;

        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            return next(new Error('Authentication token is invalid or expired'));
        }

        const user = await User.findById(payload.sub);

        if (!user) {
            return next(new Error('User no longer exists'));
        }

        // Attach user to socket for use in connection handler & emitters
        socket.user = user;

        return next();
    } catch (error) {
        return next(new Error(`Authentication failed: ${error.message}`));
    }
};

module.exports = socketAuthMiddleware;

const { getIO } = require('../config/socket');

/**
 * Centralized WebSocket notification service.
 *
 * All emit calls are wrapped in try/catch so a WS failure
 * never breaks the HTTP response that triggered the event.
 */

/**
 * Emits a realtime event to a specific user's private room.
 *
 * @param {string} userId  - MongoDB ObjectId (string)
 * @param {string} event   - Event name, e.g. "analysis.updated"
 * @param {object} payload - Data to send to the client
 */
const emitToUser = (userId, event, payload) => {
    try {
        const io = getIO();
        const room = `user:${userId.toString()}`;

        io.to(room).emit(event, {
            ...payload,
            timestamp: new Date().toISOString(),
        });

        if (process.env.NODE_ENV === 'development') {
            console.log(`[WS] emit → room="${room}" event="${event}"`);
        }
    } catch (error) {
        // Non-fatal: log but do not throw — WS must not break HTTP flow
        console.error(`[WS] emitToUser failed (event=${event}):`, error.message);
    }
};

/**
 * Emits a realtime event to all connected admins.
 *
 * @param {string} event   - Event name
 * @param {object} payload - Data to send
 */
const emitToAdmin = (event, payload) => {
    try {
        const io = getIO();

        io.to('admin').emit(event, {
            ...payload,
            timestamp: new Date().toISOString(),
        });

        if (process.env.NODE_ENV === 'development') {
            console.log(`[WS] emit → room="admin" event="${event}"`);
        }
    } catch (error) {
        console.error(`[WS] emitToAdmin failed (event=${event}):`, error.message);
    }
};

/**
 * Broadcasts a realtime event to ALL connected clients.
 * Use sparingly — prefer emitToUser for user-scoped data.
 *
 * @param {string} event   - Event name
 * @param {object} payload - Data to send
 */
const emitToAll = (event, payload) => {
    try {
        const io = getIO();

        io.emit(event, {
            ...payload,
            timestamp: new Date().toISOString(),
        });

        if (process.env.NODE_ENV === 'development') {
            console.log(`[WS] emit → broadcast event="${event}"`);
        }
    } catch (error) {
        console.error(`[WS] emitToAll failed (event=${event}):`, error.message);
    }
};

module.exports = {
    emitToUser,
    emitToAdmin,
    emitToAll,
};

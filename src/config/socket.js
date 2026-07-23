const { Server } = require('socket.io');
const socketAuthMiddleware = require('../middlewares/socket.middleware');

/** @type {import('socket.io').Server | null} */
let io = null;

/**
 * Initializes the Socket.IO server and attaches it to the HTTP server.
 * Must be called once from server.js before listening.
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
const initSocket = (httpServer) => {
    const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';

    io = new Server(httpServer, {
        // Allow same CORS origins as REST API
        cors: {
            origin: [clientUrl, 'http://localhost:3000'],
            methods: ['GET', 'POST'],
            credentials: true,
        },
        // Use websocket first, fall back to polling
        transports: ['websocket', 'polling'],
        // Ping interval / timeout for connection health
        pingInterval: 25000,
        pingTimeout: 20000,
    });

    // Apply JWT authentication middleware to all socket connections
    io.use(socketAuthMiddleware);

    io.on('connection', (socket) => {
        const userId = socket.user._id.toString();
        const userRole = socket.user.role;

        // Each user joins their own private room
        socket.join(`user:${userId}`);

        // Admins also join the shared admin room
        if (userRole === 'admin') {
            socket.join('admin');
        }

        if (process.env.NODE_ENV === 'development') {
            console.log(`[WS] Connected: userId=${userId} role=${userRole} socketId=${socket.id}`);
        }

        socket.on('disconnect', (reason) => {
            if (process.env.NODE_ENV === 'development') {
                console.log(`[WS] Disconnected: userId=${userId} reason=${reason}`);
            }
        });
    });

    console.log('[WS] Socket.IO server initialized');

    return io;
};

/**
 * Returns the initialized Socket.IO instance.
 * Throws if called before initSocket().
 *
 * @returns {import('socket.io').Server}
 */
const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO has not been initialized. Call initSocket(httpServer) first.');
    }

    return io;
};

module.exports = { initSocket, getIO };

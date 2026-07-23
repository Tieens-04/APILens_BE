require('dotenv').config();
const http = require('http');
const connectDB = require('./config/db');
const app = require('./app');
const { initSocket } = require('./config/socket');

// Kết nối tới Database
connectDB();

const PORT = process.env.PORT || 5000;

// Create HTTP server so Socket.IO can share the same port as Express
const httpServer = http.createServer(app);

// Initialize Socket.IO and attach to the HTTP server
initSocket(httpServer);

httpServer.listen(PORT, () => {
    console.log(`[SERVER] Restly API is running on port ${PORT}`);
    console.log(`[ENVIRONMENT] ${process.env.NODE_ENV}`);
});

const mongoose = require('mongoose');

let mongoMemoryServer = null;

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is missing in .env');
        }

        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 2000,
        });

        console.log(`[DATABASE] MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        if (process.env.NODE_ENV === 'test') {
            throw error;
        }

        console.warn(`[DATABASE] Local MongoDB unreachable (${error.message}).`);

        try {
            console.log('[DATABASE] Starting In-Memory MongoDB Server...');
            const { MongoMemoryServer } = require('mongodb-memory-server');
            mongoMemoryServer = await MongoMemoryServer.create();
            const memoryUri = mongoMemoryServer.getUri();
            const conn = await mongoose.connect(memoryUri);
            console.log(`[DATABASE] In-Memory MongoDB Connected Successfully: ${conn.connection.host}`);
        } catch (memErr) {
            console.error(`[DATABASE] Fatal: In-Memory MongoDB failed to start: ${memErr.message}`);
            process.exit(1);
        }
    }
};

module.exports = connectDB;

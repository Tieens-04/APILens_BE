const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is missing in .env');
        }

        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS) || 10000,
        });

        console.log(`[DATABASE] MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`[DATABASE] Error: ${error.message}`);
        if (process.env.NODE_ENV === 'test') {
            throw error;
        }
        process.exit(1);
    }
};

module.exports = connectDB;

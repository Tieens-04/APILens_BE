const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

module.exports.connect = async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
};

module.exports.closeDatabase = async () => {
    try {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.dropDatabase();
        }

        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close(true);
        }

        if (mongoServer) {
            await mongoServer.stop();
            mongoServer = undefined;
        }
    } catch (error) {
        // Teardown should be safe to call more than once.
    }
};

module.exports.clearDatabase = async () => {
    if (mongoose.connection.readyState !== 1) {
        return;
    }

    const { collections } = mongoose.connection;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany();
    }
};

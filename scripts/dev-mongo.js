/**
 * Local throwaway MongoDB for development / demo.
 * Downloads a mongod binary on first run, then listens on 27017.
 *
 *   node scripts/dev-mongo.js
 */
const { MongoMemoryServer } = require("mongodb-memory-server");

(async () => {
  try {
    const mongod = await MongoMemoryServer.create({
      instance: { port: 27017, dbName: "studiospace" },
    });
    console.log("Local MongoDB ready at:", mongod.getUri());
    console.log("Keep this process running while you develop.");
  } catch (error) {
    console.error("Failed to start local MongoDB:", error.message);
    process.exit(1);
  }
})();

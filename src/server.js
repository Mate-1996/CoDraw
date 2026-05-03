const path = require("path");
const http = require("http");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { connectDB } = require("./config/db");
const app = require("./app");
const { initializeSocket } = require("./socket");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const server = http.createServer(app);
    initializeSocket(server);

    server.listen(PORT, () => {
      console.log(`CoDraw server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

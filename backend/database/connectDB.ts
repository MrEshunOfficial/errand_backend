import mongoose from "mongoose";

let isConnected = false; // 🔒 Prevent multiple connections in dev with hot reload

export const connectDB = async () => {
  try {
    if (isConnected) {
      return; // Already connected, skip re-init
    }

    if (!process.env.MONGO_URL) {
      throw new Error("MONGO_URL environment variable is not defined");
    }

    // ⚡ Recommended connection options for performance & reliability
    await mongoose.connect(process.env.MONGO_URL, {
      maxPoolSize: 50, // increase pool size if handling many concurrent requests
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000, // faster failover if server not reachable
      socketTimeoutMS: 30000, // lower than default to free up sockets
      connectTimeoutMS: 10000, // faster initial connect
      family: 4, // force IPv4 (helps in some environments like Docker)
      retryWrites: true, // ensure safe retries on transient errors
      w: "majority", // ensure durability for write operations
    });

    isConnected = true;

    mongoose.connection.on("connected", () => {
      console.log("✅ MongoDB connected successfully");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB disconnected, retrying...");
    });

    // Graceful shutdown for Node.js apps
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("🛑 MongoDB connection closed due to app termination");
      process.exit(0);
    });
  } catch (error: any) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

import mongoose from "mongoose";
import { logEvent } from "../middleware/logger.js";

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    await logEvent("warn", "mongo_uri_missing");
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    await logEvent("info", "mongodb_connected", {
      host: conn.connection.host,
      database: conn.connection.name,
    });
  } catch (error) {
    await logEvent("warn", "mongodb_unavailable", { message: error.message });
  }
};

export default connectDB;

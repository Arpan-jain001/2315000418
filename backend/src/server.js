import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./config/db.js";
import { logEvent } from "./middleware/logger.js";

const PORT = process.env.PORT || 3000;

connectDB();

app.listen(PORT, () => {
  logEvent("info", "server_started", {
    url: `http://localhost:${PORT}`,
    mode: process.env.NODE_ENV,
  }).catch(() => {});
});

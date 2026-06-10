import express from "express";
import cors from "cors";
import { logEvent, requestLogger } from "./middleware/logger.js";

const app = express();
const NOTIFICATION_API_URL =
  process.env.NOTIFICATION_API_URL ||
  "http://4.224.186.213/evaluation-service/notifications";

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Health Check Route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running successfully 🚀",
  });
});

const normalizeNotification = (notification) => ({
  id: notification.id || notification.ID,
  type: notification.type || notification.Type,
  message: notification.message || notification.Message,
  timestamp: notification.timestamp || notification.Timestamp,
  viewed: Boolean(notification.viewed || notification.isRead),
});

app.get("/api/notifications", async (req, res) => {
  try {
    const upstreamUrl = new URL(NOTIFICATION_API_URL);

    ["limit", "page", "notification_type"].forEach((param) => {
      if (req.query[param]) upstreamUrl.searchParams.set(param, req.query[param]);
    });

    const headers = {};
    if (req.headers.authorization) {
      headers.authorization = req.headers.authorization;
    }

    const upstreamResponse = await fetch(upstreamUrl, { headers });
    const payload = await upstreamResponse.json();

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json(payload);
    }

    const notifications = Array.isArray(payload.notifications)
      ? payload.notifications.map(normalizeNotification)
      : [];

    res.status(200).json({
      success: true,
      notifications,
      meta: {
        count: notifications.length,
        source: "evaluation-service",
      },
    });
  } catch (error) {
    await logEvent("error", "notification_upstream_failed", {
      message: error.message,
    });

    res.status(502).json({
      success: false,
      message: "Unable to fetch notifications from upstream service",
      error: error.message,
    });
  }
});

// Root Route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Afford Backend 🚀",
  });
});

export default app;

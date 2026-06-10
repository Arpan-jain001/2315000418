import express from "express";
import cors from "cors";

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
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

// Root Route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Afford Backend 🚀",
  });
});

export default app;
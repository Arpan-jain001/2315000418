import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

const logDirectory = path.resolve("logs");
const logFile = path.join(logDirectory, "app.log");

export async function logEvent(level, message, metadata = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    metadata,
  };

  await mkdir(logDirectory, { recursive: true });
  await appendFile(logFile, `${JSON.stringify(entry)}\n`, "utf8");
}

export function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on("finish", () => {
    logEvent("info", "http_request", {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    }).catch(() => {});
  });

  next();
}

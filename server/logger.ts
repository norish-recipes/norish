/**
 * Unified Logger for Norish
 *
 * Uses pino for server-side logging with structured JSON output.
 *
 * Usage:
 *   import { serverLogger as log } from "@/server/logger";
 *   log.info("Message");
 *   log.info({ userId: "123" }, "User logged in");
 *   log.error({ err }, "Something failed");
 */

import pino from "pino";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const isDev = process.env.NODE_ENV === "development";

const logLevel: LogLevel =
  (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) ||
  (process.env.LOG_LEVEL as LogLevel) ||
  (isDev ? "debug" : "info");

/**
 * Server-side pino logger
 *
 * Development: Pretty colored output via pino-pretty stream
 * Production: Plain JSON to stdout for log aggregation
 */
let logger = pino({ level: logLevel });

// In development, dynamically import pino-pretty and recreate logger with pretty output
if (isDev) {
  import("pino-pretty").then((pinoPretty) => {
    const stream = pinoPretty.default({
      colorize: true,
      translateTime: "HH:MM:ss",
      ignore: "pid,hostname",
    });
    logger = pino({ level: logLevel }, stream);
  });
}

export { logger };

/**
 * Create a child logger with a specific context/module name
 * Useful for tagging logs from specific parts of the app
 *
 * Usage:
 *   const log = createLogger("recipes");
 *   log.info("Recipe imported");
 */
export function createLogger(module: string) {
  return logger.child({ module });
}

// Pre-configured loggers for common modules
export const serverLogger = createLogger("server");
export const dbLogger = createLogger("db");
export const authLogger = createLogger("auth");
export const wsLogger = createLogger("ws");
export const aiLogger = createLogger("ai");
export const trpcLogger = createLogger("trpc");
export const schedulerLogger = createLogger("scheduler");
export const videoLogger = createLogger("video");
export const parserLogger = createLogger("parser");
export const redisLogger = createLogger("redis");

export default logger;

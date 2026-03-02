/**
 * Unified Logger for Norish
 *
 * Uses pino for server-side logging with structured JSON output.
 *
 * Usage:
 *   import { serverLogger as log } from "@norish/shared-server/logger";
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

const isNextRuntime =
  !!process.env.NEXT_RUNTIME ||
  !!process.env.__NEXT_PRIVATE_ORIGINAL_ENV ||
  !!process.env.NEXT_PHASE;

const prettyTransport = { target: "pino-pretty", options: { colorize: true } };

export function buildLoggerConfig() {
  if (isDev && !isNextRuntime) {
    return { level: logLevel, transport: prettyTransport };
  }

  return { level: logLevel, transport: undefined };
}

function createRootLogger() {
  const config = buildLoggerConfig();

  try {
    return pino(config);
  } catch {
    return pino({ level: logLevel });
  }
}

/**
 * Server-side pino logger
 *
 * Development: Use pino-pretty transport when available
 * Production: Plain JSON to stdout for log aggregation
 */
const logger = createRootLogger();

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

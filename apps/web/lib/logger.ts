/**
 * Client-side Logger for Norish
 *
 * A lightweight console wrapper that:
 * - Respects NEXT_PUBLIC_LOG_LEVEL for consistent logging with backend
 * - Provides consistent log formatting with module prefixes
 * - Maintains the same API as pino for easy mental model
 */

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

// Use NEXT_PUBLIC_LOG_LEVEL for consistency with backend
const isDev = process.env.NODE_ENV === "development";
const configuredLevel =
  (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) || (isDev ? "debug" : "info");
const minLevelNum = LOG_LEVELS[configuredLevel] ?? LOG_LEVELS.info;

interface ClientLogger {
  trace: (objOrMsg: unknown, msg?: string) => void;
  debug: (objOrMsg: unknown, msg?: string) => void;
  info: (objOrMsg: unknown, msg?: string) => void;
  warn: (objOrMsg: unknown, msg?: string) => void;
  error: (objOrMsg: unknown, msg?: string) => void;
  fatal: (objOrMsg: unknown, msg?: string) => void;
}

/**
 * Create a client-side logger with a module prefix
 *
 * @param module - The module/component name for log prefixing
 * @returns Logger instance with trace, debug, info, warn, error, fatal methods
 */
export function createClientLogger(module: string): ClientLogger {
  const prefix = `[${module}]`;

  const createLogMethod = (level: LogLevel, consoleFn: (...args: unknown[]) => void) => {
    return (objOrMsg: unknown, msg?: string) => {
      if (LOG_LEVELS[level] < minLevelNum) return;

      // Support both pino-style (obj, msg) and simple (msg) calls
      if (typeof objOrMsg === "string") {
        consoleFn(prefix, objOrMsg);
      } else if (msg) {
        consoleFn(prefix, msg, objOrMsg);
      } else {
        consoleFn(prefix, objOrMsg);
      }
    };
  };

  return {
    trace: createLogMethod("trace", console.debug),
    debug: createLogMethod("debug", console.debug),
    info: createLogMethod("info", console.info),
    warn: createLogMethod("warn", console.warn),
    error: createLogMethod("error", console.error),
    fatal: createLogMethod("fatal", console.error),
  };
}

// Pre-configured loggers for common client modules
export const wsLogger = createClientLogger("ws");
export const swLogger = createClientLogger("sw");
export const uiLogger = createClientLogger("ui");

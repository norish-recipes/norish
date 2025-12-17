import { db } from "@/server/db/drizzle";
import { apiLogs, type NewApiLog } from "@/server/db/schema/api-logs";
import { trpcLogger as log } from "@/server/logger";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  procedure: string;
  type: "query" | "mutation" | "subscription";
  userId?: string | null;
  durationMs?: number;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  meta?: Record<string, unknown>;
}
class TrpcLogger {
  private readonly enableConsole: boolean;
  private readonly enableDb: boolean;
  private readonly minLevel: LogLevel;

  constructor() {
    this.enableConsole = process.env.TRPC_LOG_CONSOLE !== "false";
    this.enableDb = process.env.TRPC_LOG_DB !== "false";
    this.minLevel = (process.env.TRPC_LOG_LEVEL as LogLevel) || "info";
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];

    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatMessage(entry: LogEntry): string {
    const status = entry.success ? "Success: " : "Failure: ";
    const duration = entry.durationMs ? `${entry.durationMs}ms` : "-";
    const user = entry.userId ? `user:${entry.userId.slice(0, 8)}` : "anon";
    const error = entry.errorCode ? ` [${entry.errorCode}]` : "";

    return `${status} ${entry.type.padEnd(12)} ${entry.procedure.padEnd(30)} ${duration.padStart(6)} ${user}${error}`;
  }

  async log(entry: LogEntry): Promise<void> {
    // Subscriptions at debug level (noisy), queries/mutations at info level
    const level: LogLevel = entry.success
      ? entry.type === "subscription"
        ? "debug"
        : "info"
      : "error";

    // Console logging via pino
    if (this.enableConsole && this.shouldLog(level)) {
      const message = this.formatMessage(entry);

      if (!entry.success) {
        log.error({ errorMessage: entry.errorMessage }, message);
      } else if (entry.type === "subscription") {
        log.debug(message);
      } else {
        log.info(message);
      }
    }

    // Database logging (fire and forget)
    if (this.enableDb) {
      this.persistLog(entry).catch((err) => {
        log.error({ err }, "Failed to persist log");
      });
    }
  }

  private async persistLog(entry: LogEntry): Promise<void> {
    const record: NewApiLog = {
      procedure: entry.procedure,
      type: entry.type,
      userId: entry.userId ?? null,
      durationMs: entry.durationMs ?? null,
      success: entry.success ? "true" : "false",
      errorCode: entry.errorCode ?? null,
      errorMessage: entry.errorMessage ?? null,
      meta: entry.meta ?? null,
    };

    await db.insert(apiLogs).values(record);
  }

  success(
    procedure: string,
    type: "query" | "mutation" | "subscription",
    userId: string | null | undefined,
    durationMs: number,
    meta?: Record<string, unknown>
  ): void {
    this.log({
      procedure,
      type,
      userId,
      durationMs,
      success: true,
      meta,
    });
  }

  error(
    procedure: string,
    type: "query" | "mutation" | "subscription",
    userId: string | null | undefined,
    durationMs: number,
    errorCode: string,
    errorMessage: string,
    meta?: Record<string, unknown>
  ): void {
    this.log({
      procedure,
      type,
      userId,
      durationMs,
      success: false,
      errorCode,
      errorMessage,
      meta,
    });
  }
}

export const trpcLogger = new TrpcLogger();

import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedRedisContainer } from "@testcontainers/redis";
import type { ChildProcess } from "node:child_process";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer } from "@testcontainers/redis";
import { Client } from "pg";

const WEB_DIR = path.resolve(import.meta.dirname, "../../..");
const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");
const DIST_SERVER_ENTRY = path.join(REPO_ROOT, "dist-server/index.mjs");
const E2E_RUNTIME_DIR = path.resolve(import.meta.dirname, "../.runtime");
const START_TIMEOUT_MS = 90_000;
const STOP_TIMEOUT_MS = 15_000;

export interface HarnessUser {
  email: string;
  password: string;
  name: string;
}

interface ProductionStackOptions {
  project: "offline" | "ai";
  port: number;
  databaseName: string;
  users: readonly [HarnessUser, HarnessUser];
  /**
   * Extra variables layered over the server's own environment. Deliberately a
   * plain string map rather than NodeJS.ProcessEnv, which this repo augments
   * into a schema requiring NODE_ENV — a caller passing only AI_* settings has
   * no business restating it.
   */
  environment?: Record<string, string>;
}

export interface ProductionServer {
  stop(): Promise<void>;
}

function ensureBuilt(): void {
  if (!existsSync(DIST_SERVER_ENTRY)) {
    throw new Error(
      `Missing ${DIST_SERVER_ENTRY}. Run pnpm test:e2e at the repository root to build and run the complete browser gate.`
    );
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function portIsOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });

    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

async function stopAll(
  actions: ReadonlyArray<{ label: string; run: () => Promise<void> }>
): Promise<void> {
  const failures: Error[] = [];

  for (const action of actions) {
    try {
      await action.run();
    } catch (error) {
      failures.push(
        new Error(`${action.label}: ${error instanceof Error ? error.message : String(error)}`, {
          cause: error,
        })
      );
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, "Browser harness cleanup failed");
  }
}

export class ProductionStack {
  readonly baseURL: string;
  readonly uploadsDir: string;
  private postgres: StartedPostgreSqlContainer | null = null;
  private redis: StartedRedisContainer | null = null;
  private activeServer: ProductionServer | null = null;
  private databaseConnectionUrl: string | null = null;
  private redisConnectionUrl: string | null = null;

  constructor(private readonly options: ProductionStackOptions) {
    this.baseURL = `http://localhost:${options.port}`;
    this.uploadsDir = path.join(E2E_RUNTIME_DIR, options.project, "uploads");
  }

  get databaseUrl(): string {
    if (!this.databaseConnectionUrl) {
      throw new Error(`[${this.options.project}] database is not provisioned`);
    }

    return this.databaseConnectionUrl;
  }

  async start(): Promise<void> {
    ensureBuilt();
    mkdirSync(this.uploadsDir, { recursive: true });

    let phase = "container provisioning";

    try {
      const [postgresResult, redisResult] = await Promise.allSettled([
        new PostgreSqlContainer("postgres:17-alpine")
          .withDatabase(this.options.databaseName)
          .withUsername(this.options.databaseName)
          .withPassword(this.options.databaseName)
          .start(),
        new RedisContainer("redis:8.6.2-alpine").start(),
      ]);

      if (postgresResult.status === "fulfilled") this.postgres = postgresResult.value;
      if (redisResult.status === "fulfilled") this.redis = redisResult.value;

      const provisioningFailures = [postgresResult, redisResult]
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => result.reason);

      if (provisioningFailures.length > 0) {
        throw new AggregateError(provisioningFailures, "Testcontainer provisioning failed");
      }

      this.databaseConnectionUrl = this.postgres!.getConnectionUri();
      this.redisConnectionUrl = this.redis!.getConnectionUrl();

      phase = "migration boot";
      await this.startServer();
      await this.stopServer();

      phase = "authentication configuration";
      await this.forceAuthenticationConfig();

      phase = "authenticated boot";
      await this.startServer();

      phase = "deterministic user bootstrap";
      await this.signUp(this.options.users[0]);
      await this.forceAuthenticationConfig();
      await this.signUp(this.options.users[1]);
    } catch (error) {
      const setupError = new Error(
        `[${this.options.project}] ${phase} failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );

      try {
        await this.stop();
      } catch (cleanupError) {
        throw new AggregateError([setupError, cleanupError], setupError.message);
      }

      throw setupError;
    }
  }

  async startServer(): Promise<ProductionServer> {
    if (this.activeServer) return this.activeServer;
    ensureBuilt();

    if (await portIsOpen(this.options.port)) {
      throw new Error(
        `[${this.options.project}] port ${this.options.port} is already in use; stop the lingering process before running browser E2E`
      );
    }

    const child: ChildProcess = spawn(process.execPath, [DIST_SERVER_ENTRY], {
      cwd: WEB_DIR,
      env: this.serverEnvironment(),
      stdio: ["ignore", "inherit", "inherit"],
    });
    const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
    let stopped = false;
    const server: ProductionServer = {
      stop: async () => {
        if (stopped) return;
        stopped = true;

        if (child.exitCode === null) {
          child.kill("SIGTERM");
          const killTimer = setTimeout(() => child.kill("SIGKILL"), STOP_TIMEOUT_MS);

          await exited;
          clearTimeout(killTimer);
        }

        const closeDeadline = Date.now() + STOP_TIMEOUT_MS;

        while (await portIsOpen(this.options.port)) {
          if (Date.now() >= closeDeadline) {
            throw new Error(
              `[${this.options.project}] production port ${this.options.port} stayed open after process exit`
            );
          }

          await delay(250);
        }
      },
    };

    // Register ownership before health polling so a failed or interrupted boot
    // is cleaned up by the same lifecycle path as a fully started server.
    this.activeServer = server;

    try {
      const deadline = Date.now() + START_TIMEOUT_MS;

      while (Date.now() < deadline) {
        if (child.exitCode !== null) {
          throw new Error(
            `[${this.options.project}] production server exited early with code ${child.exitCode}`
          );
        }

        if (await this.isHealthy()) return server;
        await delay(500);
      }

      throw new Error(
        `[${this.options.project}] production health endpoint did not respond within ${START_TIMEOUT_MS}ms`
      );
    } catch (error) {
      try {
        await this.stopServer();
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], String(error));
      }

      throw error;
    }
  }

  async stopServer(): Promise<void> {
    const server = this.activeServer;

    if (!server) return;
    this.activeServer = null;
    await server.stop();
  }

  async restartServer(): Promise<void> {
    await this.stopServer();
    await this.startServer();
  }

  async stop(): Promise<void> {
    const postgres = this.postgres;
    const redis = this.redis;

    this.postgres = null;
    this.redis = null;

    await stopAll([
      { label: `[${this.options.project}] production server`, run: () => this.stopServer() },
      {
        label: `[${this.options.project}] Redis`,
        run: async () => {
          await redis?.stop();
        },
      },
      {
        label: `[${this.options.project}] PostgreSQL`,
        run: async () => {
          await postgres?.stop();
        },
      },
      {
        label: `[${this.options.project}] runtime directory`,
        run: () =>
          rm(path.join(E2E_RUNTIME_DIR, this.options.project), { recursive: true, force: true }),
      },
    ]);
  }

  private serverEnvironment(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(this.options.port),
      DATABASE_URL: this.databaseUrl,
      REDIS_URL: this.redisConnectionUrl!,
      AUTH_URL: this.baseURL,
      TRUSTED_ORIGINS: this.baseURL,
      MASTER_KEY: "X4fjLgB8egCPwlOQW8iC3JGXAtUIMUOGmk/y29n+YSw=",
      UPLOADS_DIR: this.uploadsDir,
      LOG_LEVEL: "error",
      NEXT_PUBLIC_LOG_LEVEL: "error",
      TRPC_LOG_LEVEL: "error",
      ...this.options.environment,
    };
  }

  private async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/health`, {
        signal: AbortSignal.timeout(2_000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private async forceAuthenticationConfig(): Promise<void> {
    const database = new Client({ connectionString: this.databaseUrl });

    await database.connect();

    try {
      await database.query(
        `update server_config set value = 'true'::jsonb
         where key in ('password_auth_enabled', 'registration_enabled')`
      );
    } finally {
      await database.end();
    }

    await this.redis!.executeCliCmd("flushall");
  }

  private async signUp(user: HarnessUser): Promise<void> {
    const response = await fetch(`${this.baseURL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: this.baseURL },
      body: JSON.stringify(user),
    });

    if (!response.ok && response.status !== 400 && response.status !== 422) {
      const body = await response.text().catch(() => "<unreadable>");

      throw new Error(`sign-up for ${user.email} failed: ${response.status} ${body}`);
    }
  }
}

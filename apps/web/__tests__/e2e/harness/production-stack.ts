import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedValkeyContainer } from "@testcontainers/valkey";
import type { ChildProcess } from "node:child_process";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { ValkeyContainer } from "@testcontainers/valkey";

import { setConfig } from "@norish/db/repositories/server-config";

import {
  VALKEY_IMAGE,
  valkeyUrl,
} from "../../../../../packages/shared-server/__tests__/helpers/valkey";
import { BUILT_BASE_PATH } from "./build";
import { MASTER_KEY } from "./environment";
import { connectRepositories, disconnectRepositories } from "./repositories";

const WEB_DIR = path.resolve(import.meta.dirname, "../../..");
const BUILD_ID = path.join(WEB_DIR, ".next/BUILD_ID");
const E2E_RUNTIME_DIR = path.resolve(import.meta.dirname, "../.runtime");
const START_TIMEOUT_MS = 90_000;
const STOP_TIMEOUT_MS = 15_000;

export interface HarnessUser {
  email: string;
  password: string;
  name: string;
}

interface ProductionStackOptions {
  project: "offline" | "ai" | "realtime" | "base-path";
  databaseName: string;
  users: readonly [HarnessUser, HarnessUser];
  /**
   * Extra variables layered over the server's own environment. Deliberately a
   * plain string map rather than NodeJS.ProcessEnv, which this repo augments
   * into a schema requiring NODE_ENV — a caller passing only AI_* settings has
   * no business restating it.
   */
  environment?: Record<string, string>;
  /**
   * Keep the server's stdout and stderr in memory (they still reach the
   * terminal) so a scenario can assert what the server logged. A project that
   * asserts on log lines lowers `LOG_LEVEL` in `environment` to match.
   */
  captureLogs?: boolean;
}

export interface ProductionServer {
  stop(): Promise<void>;
}

function ensureBuilt(): void {
  if (!existsSync(BUILD_ID)) {
    throw new Error(
      `Missing ${BUILD_ID}. Run pnpm test:e2e at the repository root to build and run the complete browser gate.`
    );
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * A host port nobody is listening on right now. Valkey gets a fixed binding to
 * it rather than a kernel-assigned one, because Docker re-assigns ephemeral
 * host ports on a container restart and a fixed binding survives one — which
 * is what lets a scenario restart Valkey under a server that keeps its URL.
 * The server and the embedded parser get one too, so stacks running side by
 * side, or beside a dev server, never share (or kill) each other's ports.
 */
export function freeHostPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();

    probe.unref();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();

      if (!address || typeof address === "string") {
        probe.close();
        reject(new Error("Could not allocate a free host port"));

        return;
      }

      probe.close(() => resolve(address.port));
    });
  });
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
  readonly uploadsDir: string;
  private serverPort: number | null = null;
  private readonly runtimeDir: string;
  private parserPort: number | null = null;
  private postgres: StartedPostgreSqlContainer | null = null;
  private valkey: StartedValkeyContainer | null = null;
  private activeServer: ProductionServer | null = null;
  private databaseConnectionUrl: string | null = null;
  private valkeyConnectionUrl: string | null = null;
  private capturedLogs: string[] = [];

  constructor(private readonly options: ProductionStackOptions) {
    // Every Playwright worker boots its own stack, so each takes a runtime
    // directory of its own, and a free port once it starts.
    const worker = Number(process.env.TEST_PARALLEL_INDEX ?? 0);

    this.runtimeDir = path.join(E2E_RUNTIME_DIR, `${options.project}-${worker}`);
    this.uploadsDir = path.join(this.runtimeDir, "uploads");
  }

  /** Fixed for the stack's life: a restarted server keeps its origin. */
  get origin(): string {
    return `http://localhost:${this.port}`;
  }

  /** The origin plus the base path the build was made for. */
  get baseURL(): string {
    return `${this.origin}${BUILT_BASE_PATH}`;
  }

  private get port(): number {
    if (this.serverPort === null) {
      throw new Error(`[${this.options.project}] server port is not allocated`);
    }

    return this.serverPort;
  }

  get databaseUrl(): string {
    if (!this.databaseConnectionUrl) {
      throw new Error(`[${this.options.project}] database is not provisioned`);
    }

    return this.databaseConnectionUrl;
  }

  get valkeyUrl(): string {
    if (!this.valkeyConnectionUrl) {
      throw new Error(`[${this.options.project}] Valkey is not provisioned`);
    }

    return this.valkeyConnectionUrl;
  }

  /** Everything the server wrote since the last `clearLogs()`, one entry per line. */
  logs(): readonly string[] {
    return this.capturedLogs;
  }

  clearLogs(): void {
    this.capturedLogs = [];
  }

  /** Run one `valkey-cli` command inside the Valkey container and return its output. */
  async valkeyCli(command: string, ...args: string[]): Promise<string> {
    if (!this.valkey) {
      throw new Error(`[${this.options.project}] Valkey is not provisioned`);
    }

    return (await this.valkey.executeCliCmd(command, args)).trim();
  }

  /**
   * Restart the Valkey container in place, the way an operator would: a
   * SIGTERM, which lets Valkey write its snapshot, so sessions and the Resume
   * Buffer come back with it (testcontainers' default is an immediate kill,
   * after which every session is gone and every request is anonymous). Its
   * host port is a fixed binding, so it survives the restart and the
   * server's clients reconnect on their own — which is the point.
   */
  async restartValkey(): Promise<void> {
    if (!this.valkey) {
      throw new Error(`[${this.options.project}] Valkey is not provisioned`);
    }

    // Milliseconds: testcontainers converts this to Docker's seconds itself.
    await this.valkey.restart({ timeout: 10_000 });
  }

  async start(): Promise<void> {
    ensureBuilt();
    mkdirSync(this.uploadsDir, { recursive: true });

    let phase = "container provisioning";

    try {
      this.serverPort = await freeHostPort();
      const valkeyHostPort = await freeHostPort();

      this.parserPort = await freeHostPort();
      const [postgresResult, valkeyResult] = await Promise.allSettled([
        new PostgreSqlContainer("postgres:17-alpine")
          .withDatabase(this.options.databaseName)
          .withUsername(this.options.databaseName)
          .withPassword(this.options.databaseName)
          .start(),
        new ValkeyContainer(VALKEY_IMAGE)
          .withExposedPorts({ container: 6379, host: valkeyHostPort })
          .start(),
      ]);

      if (postgresResult.status === "fulfilled") this.postgres = postgresResult.value;
      if (valkeyResult.status === "fulfilled") this.valkey = valkeyResult.value;

      const provisioningFailures = [postgresResult, valkeyResult]
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => result.reason);

      if (provisioningFailures.length > 0) {
        // Spell the reasons into the message. Playwright prints `cause` but not
        // an AggregateError's `errors`, so without this the commonest local
        // failure by far — Docker simply not running — reaches the terminal as
        // a bare "Testcontainer provisioning failed" on all 46 specs.
        throw new AggregateError(
          provisioningFailures,
          `Testcontainer provisioning failed (is Docker running?): ${provisioningFailures
            .map((failure) => (failure instanceof Error ? failure.message : String(failure)))
            .join("; ")}`
        );
      }

      this.databaseConnectionUrl = this.postgres!.getConnectionUri();
      this.valkeyConnectionUrl = valkeyUrl(this.valkey!);
      await connectRepositories(this.databaseConnectionUrl);

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
        throw new AggregateError([setupError, cleanupError], setupError.message, {
          cause: cleanupError,
        });
      }

      throw setupError;
    }
  }

  async startServer(): Promise<ProductionServer> {
    if (this.activeServer) return this.activeServer;
    ensureBuilt();

    if (await portIsOpen(this.port)) {
      throw new Error(
        `[${this.options.project}] port ${this.port} is already in use; stop the lingering process before running browser E2E`
      );
    }

    const capture = this.options.captureLogs === true;
    // As production starts it: the server's source through tsx, from apps/web.
    const child: ChildProcess = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
      cwd: WEB_DIR,
      env: this.serverEnvironment(),
      stdio: ["ignore", capture ? "pipe" : "inherit", capture ? "pipe" : "inherit"],
    });

    if (capture) {
      this.captureOutput(child);
    }
    // After a fixture setup timeout the worker calls process.exit without reaching stop(),
    // which would leave this server running with PPID 1.
    const killWithWorker = () => child.kill("SIGKILL");

    process.once("exit", killWithWorker);
    const exited = new Promise<void>((resolve) =>
      child.once("exit", () => {
        process.off("exit", killWithWorker);
        resolve();
      })
    );
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

        while (await portIsOpen(this.port)) {
          if (Date.now() >= closeDeadline) {
            throw new Error(
              `[${this.options.project}] production port ${this.port} stayed open after process exit`
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
        throw new AggregateError([error, cleanupError], String(error), { cause: cleanupError });
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
    const valkey = this.valkey;

    this.postgres = null;
    this.valkey = null;

    await stopAll([
      { label: `[${this.options.project}] production server`, run: () => this.stopServer() },
      { label: `[${this.options.project}] repository pool`, run: () => disconnectRepositories() },
      {
        label: `[${this.options.project}] Valkey`,
        run: async () => {
          await valkey?.stop();
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
        run: () => rm(this.runtimeDir, { recursive: true, force: true }),
      },
    ]);
  }

  /** Tee the child's output to this process and keep a copy, line by line. */
  private captureOutput(child: ChildProcess): void {
    const streams: Array<[NodeJS.ReadableStream | null, NodeJS.WriteStream]> = [
      [child.stdout, process.stdout],
      [child.stderr, process.stderr],
    ];

    for (const [source, sink] of streams) {
      if (!source) continue;

      let rest = "";

      source.setEncoding("utf8");
      source.on("data", (chunk: string) => {
        sink.write(chunk);
        const lines = (rest + chunk).split("\n");

        rest = lines.pop() ?? "";
        this.capturedLogs.push(...lines);
      });
      source.on("end", () => {
        if (rest) this.capturedLogs.push(rest);
        rest = "";
      });
    }
  }

  private serverEnvironment(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(this.port),
      PARSER_API_PORT: String(this.parserPort),
      DATABASE_URL: this.databaseUrl,
      VALKEY_URL: this.valkeyConnectionUrl!,
      AUTH_URL: this.baseURL,
      TRUSTED_ORIGINS: this.origin,
      NEXT_PUBLIC_BASE_PATH: BUILT_BASE_PATH,
      MASTER_KEY,
      UPLOADS_DIR: this.uploadsDir,
      LOG_LEVEL: "error",
      NEXT_PUBLIC_LOG_LEVEL: "error",
      TRPC_LOG_LEVEL: "error",
      // A project's tests share one server, and every test opens a fresh browser
      // context that re-fetches the session. Production's 20-per-60s auth
      // ceiling is reached partway through a project, after which `get-session`
      // returns 429 and pages that need client-side session data hang on their
      // skeletons — a failure about the harness, not the code under test.
      AUTH_RATE_LIMIT_ENABLED: "false",
      // Nothing outbound: a spec that needs an ingredient catalogue seeds its
      // own, rather than the server fetching Open Food Facts at boot.
      INGREDIENT_CATALOGUE_URL: "",
      // The fake shop and recipe pages answer on loopback.
      ALLOW_PRIVATE_ADDRESSES: "true",
      ...this.options.environment,
    };
  }

  /**
   * Ready for traffic, and its embedded parser answering too: readiness alone
   * does not wait for the parser, which URL-import specs need.
   */
  private async isHealthy(): Promise<boolean> {
    try {
      const responses = await Promise.all([
        fetch(`${this.baseURL}/api/v1/health/ready`, { signal: AbortSignal.timeout(2_000) }),
        fetch(`http://127.0.0.1:${this.parserPort}/health`, { signal: AbortSignal.timeout(2_000) }),
      ]);

      return responses.every((response) => response.ok);
    } catch {
      return false;
    }
  }

  private async forceAuthenticationConfig(): Promise<void> {
    await setConfig("password_auth_enabled", true, null);
    await setConfig("registration_enabled", true, null);
    await this.valkey!.executeCliCmd("flushall");
  }

  private async signUp(user: HarnessUser): Promise<void> {
    const response = await fetch(`${this.baseURL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: this.origin },
      body: JSON.stringify(user),
    });

    if (!response.ok && response.status !== 400 && response.status !== 422) {
      const body = await response.text().catch(() => "<unreadable>");

      throw new Error(`sign-up for ${user.email} failed: ${response.status} ${body}`);
    }
  }
}

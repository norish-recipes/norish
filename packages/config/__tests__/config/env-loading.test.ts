/**
 * @vitest-environment node
 *
 * How the server's environment is loaded: from the nearest `.env.local` above
 * the working directory, or from the process environment, which wins over the
 * file. Each test re-imports the module, since loading is a side effect.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const originalEnv = process.env;
const originalCwd = process.cwd();
let tmpDir: string;

beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "norish-env-loading-"));
  fs.mkdirSync(path.join(tmpDir, "apps", "web"), { recursive: true });
  process.chdir(path.join(tmpDir, "apps", "web"));
  process.env = { ...originalEnv, NODE_ENV: "development", SKIP_ENV_VALIDATION: "1" };
  delete process.env.VALKEY_URL;
  delete process.env.REDIS_URL;
});

afterEach(() => {
  process.env = originalEnv;
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

it("reads the nearest .env.local above the working directory", async () => {
  fs.writeFileSync(path.join(tmpDir, ".env.local"), "VALKEY_URL=valkey://from-file:6379\n");

  const { SERVER_CONFIG } = await import("@norish/config/env-config-server");

  expect(SERVER_CONFIG.VALKEY_URL).toBe("valkey://from-file:6379");
});

it("takes a variable set in the process environment over the file", async () => {
  fs.writeFileSync(path.join(tmpDir, ".env.local"), "VALKEY_URL=valkey://from-file:6379\n");
  process.env.VALKEY_URL = "valkey://from-process:6379";

  const { SERVER_CONFIG } = await import("@norish/config/env-config-server");

  expect(SERVER_CONFIG.VALKEY_URL).toBe("valkey://from-process:6379");
});

it("runs on the process environment alone when there is no file", async () => {
  process.env.VALKEY_URL = "valkey://from-process:6379";

  const { SERVER_CONFIG } = await import("@norish/config/env-config-server");

  expect(SERVER_CONFIG.VALKEY_URL).toBe("valkey://from-process:6379");
});

it("falls back to REDIS_URL from before Valkey, and VALKEY_URL wins over it", async () => {
  expect((await import("@norish/config/env-config-server")).SERVER_CONFIG.VALKEY_URL).toBe(
    "valkey://localhost:6379"
  );

  vi.resetModules();
  process.env.REDIS_URL = "redis://redis:6379";

  expect((await import("@norish/config/env-config-server")).SERVER_CONFIG.VALKEY_URL).toBe(
    "redis://redis:6379"
  );

  vi.resetModules();
  process.env.VALKEY_URL = "valkey://valkey:6379";

  expect((await import("@norish/config/env-config-server")).SERVER_CONFIG.VALKEY_URL).toBe(
    "valkey://valkey:6379"
  );
});

it("refuses an AUTH_URL whose path is not the base path the app was built for", async () => {
  process.env.VALKEY_URL = "valkey://from-process:6379";
  process.env.AUTH_URL = "https://example.com/norish";
  delete process.env.NEXT_PUBLIC_BASE_PATH;

  await expect(import("@norish/config/env-config-server")).rejects.toThrow("NEXT_PUBLIC_BASE_PATH");

  vi.resetModules();
  process.env.NEXT_PUBLIC_BASE_PATH = "/norish";
  process.env.AUTH_URL = "https://example.com/norish/";

  const { SERVER_CONFIG } = await import("@norish/config/env-config-server");

  expect(SERVER_CONFIG.NEXT_PUBLIC_BASE_PATH).toBe("/norish");
});

/**
 * @vitest-environment node
 *
 * Tests for component-based DATABASE_URL assembly.
 * This feature runs as a side-effect at the top of env-config-server.ts,
 * so each test manipulates process.env, dynamically re-imports the module,
 * and verifies the resulting SERVER_CONFIG.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tmpDir: string;
let originalCwd: string;
const originalEnv = process.env;

function setEnv(key: string, value: string) {
  process.env[key] = value;
}

describe("env-config-server secret resolution", () => {
  beforeEach(() => {
    vi.resetModules();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "norish-cfg-test-"));

    originalCwd = process.cwd();
    process.chdir(tmpDir);

    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      SKIP_ENV_VALIDATION: "1",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    process.chdir(originalCwd);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("DATABASE_URL fallback assembly", () => {
    it("assembles DATABASE_URL from optional component vars", async () => {
      delete process.env.DATABASE_URL;
      setEnv("DATABASE_HOST", "mydbhost");
      setEnv("DATABASE_PORT", "5433");
      setEnv("DATABASE", "mydb");
      setEnv("DATABASE_USER", "myuser");
      setEnv("DATABASE_PASSWORD", "mypass");

      const { SERVER_CONFIG } = await import("@norish/config/env-config-server");

      expect(SERVER_CONFIG.DATABASE_URL).toBe("postgresql://myuser:mypass@mydbhost:5433/mydb");
    });

    it("uses defaults when no DB vars are provided", async () => {
      delete process.env.DATABASE_URL;

      const { SERVER_CONFIG } = await import("@norish/config/env-config-server");

      expect(SERVER_CONFIG.DATABASE_URL).toBe("postgresql://postgres:norish@localhost:5432/norish");
    });

    it("encodes special characters in password", async () => {
      delete process.env.DATABASE_URL;
      setEnv("DATABASE_PASSWORD", "p@ss:w0rd");

      const { SERVER_CONFIG } = await import("@norish/config/env-config-server");

      expect(SERVER_CONFIG.DATABASE_URL).toContain("p%40ss%3Aw0rd");
      expect(SERVER_CONFIG.DATABASE_URL).toContain("@localhost:");
    });

    it("does not override an explicit DATABASE_URL", async () => {
      const directUrl = "postgresql://explicit:explicit@db:5432/explicit";
      setEnv("DATABASE_URL", directUrl);
      setEnv("DATABASE", "should-not-be-used");

      const { SERVER_CONFIG } = await import("@norish/config/env-config-server");

      expect(SERVER_CONFIG.DATABASE_URL).toBe(directUrl);
    });
  });

  describe("MASTER_KEY", () => {
    it("is unset when blank, as Compose passes an unset ${MASTER_KEY}", async () => {
      for (const blank of ["", " "]) {
        vi.resetModules();
        setEnv("MASTER_KEY", blank);
        setEnv("MASTER_KEY_PREVIOUS", blank);

        const { SERVER_CONFIG } = await import("@norish/config/env-config-server");

        expect(SERVER_CONFIG.MASTER_KEY).toBeUndefined();
        expect(SERVER_CONFIG.MASTER_KEY_PREVIOUS).toBeUndefined();
      }
    });

    it("still refuses a key too short to be one", async () => {
      setEnv("MASTER_KEY", "short");

      await expect(import("@norish/config/env-config-server")).rejects.toThrow("MASTER_KEY");
    });
  });
});

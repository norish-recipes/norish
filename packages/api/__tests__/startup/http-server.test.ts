// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const webAppDir = mkdtempSync(join(tmpdir(), "norish-web-"));
const mockNext = vi.fn();

vi.mock("next", () => ({ default: mockNext }));
vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: { NODE_ENV: "production", HOST: "0.0.0.0", PORT: 3000 },
}));
vi.mock("@norish/shared-server/lib/workspace-paths", () => ({
  resolveExistingWorkspacePath: () => webAppDir,
}));
vi.mock("@norish/shared-server/logger", () => ({ serverLogger: { error: vi.fn() } }));
vi.mock("@norish/trpc/server", () => ({ initTrpcWebSocket: vi.fn() }));
vi.mock("../../src/startup/static-files", () => ({ serveStaticFile: vi.fn() }));

describe("createServer", () => {
  afterEach(() => {
    delete process.env.__NEXT_PRIVATE_STANDALONE_CONFIG;
  });

  // #359: evaluating next.config.js at boot loads next-intl's @swc/core, whose
  // native addon cannot unpack on a read-only root filesystem.
  it("hands Next the config the build resolved instead of evaluating next.config.js", async () => {
    mkdirSync(join(webAppDir, ".next"), { recursive: true });
    writeFileSync(
      join(webAppDir, ".next", "required-server-files.json"),
      JSON.stringify({ config: { basePath: "", distDir: ".next" } })
    );
    let configSeenByNext: string | undefined;

    mockNext.mockImplementation(() => {
      configSeenByNext = process.env.__NEXT_PRIVATE_STANDALONE_CONFIG;

      return { getRequestHandler: vi.fn(), prepare: vi.fn() };
    });

    const { createServer } = await import("../../src/startup/http-server");

    await createServer();

    expect(configSeenByNext).toBe(JSON.stringify({ basePath: "", distDir: ".next" }));
  });
});

// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "development";

const dbExecuteMock = vi.hoisted(() => vi.fn());
const dbInsertValuesMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const dbInsertMock = vi.hoisted(() => vi.fn().mockReturnValue({ values: dbInsertValuesMock }));
const getDatabaseHealthMock = vi.hoisted(() => vi.fn());

vi.mock("@norish/auth/providers", () => ({
  getAvailableProviders: vi.fn().mockResolvedValue([]),
  isPasswordAuthEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock("@norish/config/server-config-loader", () => ({
  getLocaleConfig: vi.fn().mockResolvedValue({
    defaultLocale: "en",
    locales: { en: { enabled: true, name: "English" } },
  }),
  getRecurrenceConfig: vi.fn().mockResolvedValue({}),
  getTimerKeywords: vi.fn().mockResolvedValue([]),
  getUnits: vi.fn().mockResolvedValue({}),
  isRegistrationEnabled: vi.fn().mockResolvedValue(false),
  isTimersEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock("@norish/db/repositories/tags", () => ({
  listAllTagNames: vi.fn().mockResolvedValue([]),
}));

vi.mock("@norish/db/drizzle", () => ({
  db: {
    execute: dbExecuteMock,
    insert: dbInsertMock,
  },
  getDatabaseHealth: getDatabaseHealthMock,
}));

vi.mock("@norish/config/env-config-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/config/env-config-server")>();

  return {
    ...actual,
    SERVER_CONFIG: {
      ...actual.SERVER_CONFIG,
      PARSER_API_TIMEOUT_MS: 15000,
    },
    buildInternalParserApiUrl: (pathname: string) =>
      new URL(pathname, "http://127.0.0.1:8001").toString(),
  };
});

const getSessionMock = vi.hoisted(() => vi.fn());

async function readVersion(relativePathFromRepoRoot: string) {
  const packageJson = await readFile(
    path.resolve(process.cwd(), "../..", relativePathFromRepoRoot),
    "utf8"
  );

  return (JSON.parse(packageJson) as { version: string }).version;
}

vi.mock("@norish/auth/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

describe("openapi health endpoint", () => {
  beforeEach(() => {
    vi.resetModules();
    getSessionMock.mockReset();
    dbExecuteMock.mockReset();
    dbExecuteMock.mockResolvedValue([]);
    getDatabaseHealthMock.mockReset();
    getDatabaseHealthMock.mockImplementation(async () => {
      try {
        await dbExecuteMock();

        return {
          status: "ok",
        } as const;
      } catch {
        return {
          status: "error",
        } as const;
      }
    });
    dbInsertMock.mockClear();
    dbInsertValuesMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it(
    "returns ok for anonymous callers when the parser is healthy",
    { timeout: 30000 },
    async () => {
      getSessionMock.mockResolvedValue(null);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ status: "ok", recipeScrapersVersion: "15.10.0" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const [appVersion, webVersion, mobileVersion] = await Promise.all([
        readVersion("package.json"),
        readVersion("apps/web/package.json"),
        readVersion("apps/mobile/package.json"),
      ]);

      const { handleOpenApiRequest } = await import("../../src/openapi");
      const response = await handleOpenApiRequest(new Request("http://localhost/api/v1/health"));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        status: "ok",
        db: {
          status: "ok",
        },
        versions: {
          app: appVersion,
          web: webVersion,
          mobile: mobileVersion,
          scraper: "15.10.0",
        },
        parser: {
          status: "ok",
          recipeScrapersVersion: "15.10.0",
        },
      });
      expect(fetch).toHaveBeenCalledWith(
        "http://127.0.0.1:8001/health",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    }
  );

  it("returns 503 for anonymous callers when the parser is unhealthy", async () => {
    getSessionMock.mockResolvedValue(null);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    const { handleOpenApiRequest } = await import("../../src/openapi");
    const response = await handleOpenApiRequest(new Request("http://localhost/api/v1/health"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        code: "SERVICE_UNAVAILABLE",
        message: "Parser service is error",
      })
    );
  });

  it("returns 503 for anonymous callers when the database is unhealthy", async () => {
    getSessionMock.mockResolvedValue(null);
    dbExecuteMock.mockRejectedValueOnce(new Error("db down"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "ok", recipeScrapersVersion: "15.10.0" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const { handleOpenApiRequest } = await import("../../src/openapi");
    const response = await handleOpenApiRequest(new Request("http://localhost/api/v1/health"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        code: "SERVICE_UNAVAILABLE",
        message: "Database is error",
      })
    );
  });

  it("rejects anonymous requests to protected openapi endpoints", async () => {
    getSessionMock.mockResolvedValue(null);

    const { handleOpenApiRequest } = await import("../../src/openapi");
    const response = await handleOpenApiRequest(
      new Request("http://localhost/api/v1/recipes/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        message: "You must be logged in to access this resource",
        code: "UNAUTHORIZED",
      })
    );
  });

  it("documents health as public while protected endpoints require security", async () => {
    const { getOpenApiDocument } = await import("../../src/openapi");
    const document = getOpenApiDocument("http://localhost");

    expect(document.paths["/health"]?.get).toEqual(
      expect.objectContaining({
        tags: ["Health"],
      })
    );
    expect(document.paths["/health"]?.get?.security).toBeUndefined();
    expect(document.paths["/recipes/search"]?.post?.security).toEqual([
      { ApiKeyAuth: [] },
      { BearerAuth: [] },
    ]);
    expect(document.paths["/recipes"]?.post?.security).toEqual([
      { ApiKeyAuth: [] },
      { BearerAuth: [] },
    ]);
  });
});

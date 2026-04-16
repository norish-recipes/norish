// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "development";

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

      const { handleOpenApiRequest } = await import("../../src/openapi");
      const response = await handleOpenApiRequest(new Request("http://localhost/api/v1/health"));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        status: "ok",
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
  });
});

// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiKeyRateLimited } from "@norish/auth/api-key-rate-limit";

import { getOpenApiDocument, handleOpenApiRequest } from "../../src/openapi";

process.env.NODE_ENV = "development";

const dbExecuteMock = vi.hoisted(() => vi.fn());
const dbInsertValuesMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const dbInsertMock = vi.hoisted(() => vi.fn().mockReturnValue({ values: dbInsertValuesMock }));
const getDatabaseHealthMock = vi.hoisted(() => vi.fn());
const getValkeyHealthMock = vi.hoisted(() => vi.fn());

vi.mock("@norish/auth/providers", () => ({
  getAvailableProviders: vi.fn().mockResolvedValue([]),
  isPasswordAuthEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
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

vi.mock("@norish/shared-server/valkey/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/valkey/client")>()),
  getValkeyHealth: getValkeyHealthMock,
}));

const getSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@norish/auth/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

describe("openapi health endpoint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects anonymous requests to protected openapi endpoints", async () => {
    getSessionMock.mockResolvedValue(null);

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

  it("answers a rate-limited API key with 429 and Retry-After, not 401", async () => {
    getSessionMock.mockRejectedValue(apiKeyRateLimited(1200));

    const response = await handleOpenApiRequest(
      new Request("http://localhost/api/v1/groceries", { headers: { "x-api-key": "key" } })
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("1200");
  });

  it("documents the protected endpoints as requiring security", () => {
    const document = getOpenApiDocument();

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

function parserAnswers(status: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      status === 200
        ? new Response(JSON.stringify({ status: "ok", recipeScrapersVersion: "15.10.0" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        : new Response(null, { status })
    )
  );
}

describe("openapi liveness and readiness endpoints", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(null);
    getDatabaseHealthMock.mockReset();
    getDatabaseHealthMock.mockResolvedValue({ status: "ok" });
    getValkeyHealthMock.mockReset();
    getValkeyHealthMock.mockResolvedValue({ status: "ok" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const get = (path: string) => handleOpenApiRequest(new Request(`http://localhost/api/v1${path}`));

  describe("/health/live", () => {
    it("answers 200 while the parser answers, Postgres and Valkey down or not", async () => {
      parserAnswers(200);
      getDatabaseHealthMock.mockResolvedValue({ status: "error" });
      getValkeyHealthMock.mockResolvedValue({ status: "error" });

      const response = await get("/health/live");

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        status: "ok",
        parser: { status: "ok", recipeScrapersVersion: "15.10.0" },
      });
      expect(getDatabaseHealthMock).not.toHaveBeenCalled();
      expect(getValkeyHealthMock).not.toHaveBeenCalled();
    });

    it("answers 503 when the parser does not answer", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));

      const response = await get("/health/live");

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({ message: "Parser service is unreachable" })
      );
    });
  });

  describe("/health/ready", () => {
    it("answers 200 with the parser down, reporting it", async () => {
      parserAnswers(503);

      const response = await get("/health/ready");

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        status: "ok",
        db: { status: "ok" },
        valkey: { status: "ok" },
        parser: { status: "error", statusCode: 503 },
      });
    });

    it("waits on a parser that never answers no longer than on Valkey's ping", async () => {
      const timeout = vi
        .spyOn(AbortSignal, "timeout")
        .mockImplementation(() => AbortSignal.abort(new DOMException("timed out", "TimeoutError")));

      vi.stubGlobal(
        "fetch",
        vi.fn(
          (_url: string, init: RequestInit) =>
            new Promise((_resolve, reject) => {
              const signal = init.signal as AbortSignal;

              if (signal.aborted) reject(signal.reason);
              signal.addEventListener("abort", () => reject(signal.reason));
            })
        )
      );

      const response = await get("/health/ready");

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({ parser: { status: "unreachable" } })
      );
      expect(timeout).toHaveBeenCalledWith(2_000);
      timeout.mockRestore();
    });

    it("answers 503 when Postgres is down", async () => {
      parserAnswers(200);
      getDatabaseHealthMock.mockResolvedValue({ status: "error" });

      const response = await get("/health/ready");

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({ message: "Database is error" })
      );
    });

    it("answers 503 when Valkey does not answer its ping", async () => {
      parserAnswers(200);
      getValkeyHealthMock.mockResolvedValue({ status: "error" });

      const response = await get("/health/ready");

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({ message: "Valkey is error" })
      );
    });
  });

  describe("/health", () => {
    it("still answers as ready, marked deprecated", async () => {
      parserAnswers(503);
      getValkeyHealthMock.mockResolvedValue({ status: "error" });

      const response = await get("/health");

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({ message: "Valkey is error" })
      );
      expect(getOpenApiDocument().paths["/health"]?.get?.deprecated).toBe(true);
    });
  });

  it("are both documented as public", () => {
    const { paths } = getOpenApiDocument();

    for (const path of ["/health/live", "/health/ready"]) {
      expect(paths[path]?.get?.tags, path).toEqual(["Health"]);
      expect(paths[path]?.get?.security, path).toBeUndefined();
    }
  });
});

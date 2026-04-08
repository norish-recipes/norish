// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@norish/config/env-config-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/config/env-config-server")>();

  return {
    ...actual,
    SERVER_CONFIG: {
      ...actual.SERVER_CONFIG,
      PARSER_API_TIMEOUT_MS: 15000,
    },
  };
});

describe("api health route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok when the parser health endpoint is healthy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "ok", recipeScrapersVersion: "15.10.0" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();

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
  });

  it("returns degraded when the parser health endpoint fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    );

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "degraded",
      parser: {
        status: "error",
        statusCode: 503,
      },
    });
  });
});

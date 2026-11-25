import { createTRPCUntypedClient } from "@trpc/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { isBackendUnreachableError } from "@norish/shared/lib/trpc-errors";

import { createTRPCClientLinks } from "../trpc/trpc-links";
import { classifyReplayError, isStaleResult } from "./error-classification";

/** What a call through the app's own links fails with when a proxy answers in HTML. */
async function proxyAnswer(status: number, type: "mutation" | "query" = "mutation") {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response("<html><body>Gateway</body></html>", {
          status,
          headers: { "content-type": "text/html" },
        })
    )
  );
  const client = createTRPCUntypedClient({
    links: createTRPCClientLinks({
      logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
      getBaseUrl: () => "http://norish.test",
      includeSubscriptions: false,
      enableLoggerLink: false,
    }),
  });

  // A query that is not an admin read goes through the batch link.
  const call =
    type === "mutation"
      ? client.mutation("admin.enrichAllRecipes", {})
      : client.query("recipes.get", { id: "recipe-1" });

  return call.catch((error: unknown) => error);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a proxy's HTML answer", () => {
  it("504: the request reached a server that may have run it, so it is ambiguous", async () => {
    const error = await proxyAnswer(504);

    expect(isBackendUnreachableError(error)).toBe(false);
    expect(classifyReplayError(error)).toBe("ambiguous");
  });

  it("504 on a batched read: ambiguous too, not offline", async () => {
    const error = await proxyAnswer(504, "query");

    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain("batch=1");
    expect(isBackendUnreachableError(error)).toBe(false);
    expect(classifyReplayError(error)).toBe("ambiguous");
  });

  it("502 and 503: the backend is down behind the proxy, so it is unreachable", async () => {
    for (const status of [502, 503]) {
      const error = await proxyAnswer(status);

      expect(isBackendUnreachableError(error)).toBe(true);
      expect(classifyReplayError(error)).toBe("unreachable");
    }
  });
});

describe("classifyReplayError", () => {
  it("classifies a network failure as unreachable (halt, resume on recovery)", () => {
    expect(classifyReplayError(new TypeError("Failed to fetch"))).toBe("unreachable");
    expect(classifyReplayError(new TypeError("network request failed"))).toBe("unreachable");
  });

  it("classifies a 401 as unauthorized (halt the whole queue)", () => {
    expect(classifyReplayError({ data: { code: "UNAUTHORIZED", httpStatus: 401 } })).toBe(
      "unauthorized"
    );
  });

  it("classifies a 5xx, 408 or 429 as ambiguous (bounded retry)", () => {
    expect(classifyReplayError({ data: { httpStatus: 500 } })).toBe("ambiguous");
    expect(classifyReplayError({ data: { httpStatus: 503 } })).toBe("ambiguous");
    expect(classifyReplayError({ data: { httpStatus: 408 } })).toBe("ambiguous");
    expect(classifyReplayError({ data: { httpStatus: 429, code: "TOO_MANY_REQUESTS" } })).toBe(
      "ambiguous"
    );
  });

  it("classifies a 4xx (or statusless) rejection as deterministic (park, keep draining)", () => {
    expect(classifyReplayError({ data: { httpStatus: 400, code: "BAD_REQUEST" } })).toBe(
      "deterministic"
    );
    expect(classifyReplayError({ data: { code: "CONFLICT" } })).toBe("deterministic");
    expect(classifyReplayError(new Error("boom"))).toBe("deterministic");
  });

  it("retries a write its Owner's move overtook, and parks any other conflict", () => {
    const ownerMoved = { data: { code: "SERVICE_UNAVAILABLE", httpStatus: 503 } };

    expect(classifyReplayError(ownerMoved)).toBe("ambiguous");
    expect(classifyReplayError({ data: { code: "CONFLICT", httpStatus: 409 } })).toBe(
      "deterministic"
    );
  });

  it("treats 401 ahead of any status heuristic", () => {
    expect(classifyReplayError({ data: { code: "UNAUTHORIZED", httpStatus: 401 } })).not.toBe(
      "deterministic"
    );
  });
});

describe("isStaleResult", () => {
  it("detects a first-writer-wins dropped write", () => {
    expect(isStaleResult({ success: true, stale: true })).toBe(true);
  });

  it("is false for anything else", () => {
    expect(isStaleResult({ success: true })).toBe(false);
    expect(isStaleResult({ stale: false })).toBe(false);
    expect(isStaleResult(null)).toBe(false);
    expect(isStaleResult("stale")).toBe(false);
    expect(isStaleResult(undefined)).toBe(false);
  });
});

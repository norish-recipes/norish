import { HEALTH_PROBE_PATH, probeBackendReachable } from "@/lib/connectivity/probe";
import { afterEach, describe, expect, it, vi } from "vitest";

type FetchArgs = { url: string; init: RequestInit };

function fakeFetch(response: { ok: boolean } | Error, capture?: FetchArgs[]) {
  return vi.fn((url: string, init: RequestInit) => {
    capture?.push({ url, init });

    if (response instanceof Error) {
      return Promise.reject(response);
    }

    return Promise.resolve(response as Response);
  });
}

describe("probeBackendReachable", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports reachable when the health endpoint responds OK", async () => {
    await expect(probeBackendReachable({ fetchImpl: fakeFetch({ ok: true }) })).resolves.toBe(true);
  });

  it("reports unreachable on a non-OK response (e.g. 503 degraded)", async () => {
    await expect(probeBackendReachable({ fetchImpl: fakeFetch({ ok: false }) })).resolves.toBe(
      false
    );
  });

  it("reports unreachable when the request throws (network error)", async () => {
    await expect(
      probeBackendReachable({ fetchImpl: fakeFetch(new TypeError("Failed to fetch")) })
    ).resolves.toBe(false);
  });

  it("hits the health path with a cache-busting param and no caching", async () => {
    const calls: FetchArgs[] = [];

    await probeBackendReachable({ fetchImpl: fakeFetch({ ok: true }, calls), now: () => 12345 });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(HEALTH_PROBE_PATH);
    expect(calls[0]!.url).toContain("12345");
    expect(calls[0]!.url).not.toBe(HEALTH_PROBE_PATH);
    expect(calls[0]!.init.method).toBe("GET");
    expect(calls[0]!.init.cache).toBe("no-store");
    expect(calls[0]!.init.signal).toBeInstanceOf(AbortSignal);
  });

  it("aborts and reports unreachable when the probe exceeds the timeout", async () => {
    vi.useFakeTimers();

    const hangingFetch = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          );
        })
    );

    const promise = probeBackendReachable({ fetchImpl: hangingFetch, timeoutMs: 5000 });

    await vi.advanceTimersByTimeAsync(5000);

    await expect(promise).resolves.toBe(false);
  });
});

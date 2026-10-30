// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("default transport URLs", () => {
  it("stays at the root without a base path", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");
    vi.resetModules();

    const { defaultGetBaseUrl, defaultGetWsUrl } = await import("../../src/providers/trpc-links");
    const port = process.env.PORT ?? 3000;

    expect(defaultGetBaseUrl()).toBe(`http://localhost:${port}`);
    expect(defaultGetWsUrl()).toBe(`ws://localhost:${port}/trpc`);
  });

  it("carries the base path into the HTTP and socket URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/norish");
    vi.resetModules();

    const { defaultGetBaseUrl, defaultGetWsUrl } = await import("../../src/providers/trpc-links");
    const port = process.env.PORT ?? 3000;

    expect(defaultGetBaseUrl()).toBe(`http://localhost:${port}/norish`);
    expect(defaultGetWsUrl()).toBe(`ws://localhost:${port}/norish/trpc`);
  });
});

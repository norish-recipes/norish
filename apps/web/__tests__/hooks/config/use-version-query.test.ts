import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateUseVersionQuery = vi.hoisted(() =>
  vi.fn((options: { getCurrentVersion: () => string }) => () => ({
    currentVersion: options.getCurrentVersion(),
  }))
);

vi.mock("@norish/shared-react/hooks", () => ({
  createUseVersionQuery: mockCreateUseVersionQuery,
}));

describe("useVersionQuery", () => {
  const originalVersion = process.env.NEXT_PUBLIC_APP_VERSION;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    if (originalVersion === undefined) {
      delete process.env.NEXT_PUBLIC_APP_VERSION;
      return;
    }

    process.env.NEXT_PUBLIC_APP_VERSION = originalVersion;
  });

  it("returns the configured public app version", async () => {
    process.env.NEXT_PUBLIC_APP_VERSION = "0.18.1-beta";

    const { useVersionQuery } = await import("@/hooks/config/use-version-query");

    expect(useVersionQuery().currentVersion).toBe("0.18.1-beta");
  });

  it("falls back to unknown when no version is configured", async () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION;

    const { useVersionQuery } = await import("@/hooks/config/use-version-query");

    expect(useVersionQuery().currentVersion).toBe("unknown");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  delete process.env.NORISH_VERSION_REPORT_JSON;
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("getAppVersions", () => {
  it("returns unavailable metadata when deployment version metadata is absent", async () => {
    const { getAppVersions } = await import("../src/index.ts");

    expect(getAppVersions()).toEqual({
      root: "unavailable",
      apps: {},
      packages: {},
    });
  });

  it("reads explicit deployment version metadata for every app and package", async () => {
    process.env.NORISH_VERSION_REPORT_JSON = JSON.stringify({
      root: "1.2.3",
      apps: {
        mobile: "7.8.9",
        "parser-api": "8.9.10",
        web: "4.5.6",
      },
      packages: {
        api: "1.0.0",
        trpc: "2.0.0",
      },
    });

    const { getAppVersions } = await import("../src/index.ts");

    expect(getAppVersions()).toEqual({
      root: "1.2.3",
      apps: {
        mobile: "7.8.9",
        "parser-api": "8.9.10",
        web: "4.5.6",
      },
      packages: {
        api: "1.0.0",
        trpc: "2.0.0",
      },
    });
  });

  it("falls back partial invalid metadata without reading package manifests", async () => {
    process.env.NORISH_VERSION_REPORT_JSON = JSON.stringify({
      root: "1.2.3",
      apps: ["web"],
      packages: {
        api: "1.0.0",
      },
    });

    const { getAppVersions } = await import("../src/index.ts");

    expect(getAppVersions()).toEqual({
      root: "1.2.3",
      apps: {},
      packages: {
        api: "1.0.0",
      },
    });
  });

  it("returns unavailable metadata when deployment version metadata is malformed", async () => {
    process.env.NORISH_VERSION_REPORT_JSON = "not-json";

    const { getAppVersions } = await import("../src/index.ts");

    expect(getAppVersions()).toEqual({
      root: "unavailable",
      apps: {},
      packages: {},
    });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { addBasePathToUrl, APP_ROOT, prefixPath } from "@norish/shared/lib/base-path";

describe("APP_ROOT", () => {
  it("is the domain root without a base path", () => {
    expect(APP_ROOT).toBe("/");
  });
});

describe("prefixPath", () => {
  it("leaves a path alone at the root", () => {
    expect(prefixPath("", "/api/trpc")).toBe("/api/trpc");
  });

  it("prefixes an absolute path", () => {
    expect(prefixPath("/norish", "/api/trpc")).toBe("/norish/api/trpc");
  });

  it("does not prefix a path twice", () => {
    expect(prefixPath("/norish", "/norish/api/trpc")).toBe("/norish/api/trpc");
    expect(prefixPath("/norish", "/norish")).toBe("/norish");
  });

  it("leaves a relative path alone", () => {
    expect(prefixPath("/norish", "api/trpc")).toBe("api/trpc");
  });
});

describe("base-path module", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reads the build-time prefix and applies it to paths and URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/norish");
    vi.resetModules();

    const {
      APP_ROOT: root,
      BASE_PATH,
      addBasePath,
      stripBasePath,
      addBasePathToUrl: addUrl,
    } = await import("@norish/shared/lib/base-path");

    expect(BASE_PATH).toBe("/norish");
    expect(root).toBe("/norish");
    expect(addBasePath("/api/trpc")).toBe("/norish/api/trpc");
    expect(addBasePath("/norish/api/trpc")).toBe("/norish/api/trpc");
    expect(stripBasePath("/norish/api/trpc")).toBe("/api/trpc");
    expect(stripBasePath("/norish")).toBe("/");
    expect(stripBasePath("/other")).toBe("/other");
    expect(addUrl("/logo.svg")).toBe("/norish/logo.svg");
    expect(addUrl("https://example.com/logo.svg")).toBe("https://example.com/logo.svg");
    expect(addUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });
});

describe("addBasePathToUrl", () => {
  it("leaves absolute and inline URLs alone", () => {
    expect(addBasePathToUrl("https://example.com/logo.svg")).toBe("https://example.com/logo.svg");
    expect(addBasePathToUrl("//cdn.example.com/logo.svg")).toBe("//cdn.example.com/logo.svg");
    expect(addBasePathToUrl("blob:https://example.com/id")).toBe("blob:https://example.com/id");
  });
});

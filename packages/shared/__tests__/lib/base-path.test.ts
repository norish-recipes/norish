import { afterEach, describe, expect, it, vi } from "vitest";

async function basePath(value: string) {
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", value);
  vi.resetModules();

  return import("@norish/shared/lib/base-path");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("base path", () => {
  it("leaves every path alone at the root", async () => {
    const { APP_ROOT, addBasePath, stripBasePath } = await basePath("");

    expect(APP_ROOT).toBe("/");
    expect(addBasePath("/api/trpc")).toBe("/api/trpc");
    expect(stripBasePath("/recipes/1")).toBe("/recipes/1");
  });

  it("prefixes a root-relative path exactly once", async () => {
    const { APP_ROOT, addBasePath } = await basePath("/norish");

    expect(APP_ROOT).toBe("/norish");
    expect(addBasePath("/api/trpc")).toBe("/norish/api/trpc");
    expect(addBasePath("/norish/logo.svg")).toBe("/norish/norish/logo.svg");
  });

  it("prefixes a path that starts like the prefix, so the prefix may equal a route", async () => {
    const { addBasePath, stripBasePath } = await basePath("/recipes");

    expect(addBasePath("/recipes/1/image.jpg")).toBe("/recipes/recipes/1/image.jpg");
    expect(stripBasePath("/recipes/recipes/1")).toBe("/recipes/1");
  });

  it("leaves absolute, protocol-relative, data, blob and relative URLs alone", async () => {
    const { addBasePath } = await basePath("/norish");

    for (const url of [
      "https://example.com/logo.svg",
      "//cdn.example.com/logo.svg",
      "data:image/png;base64,AAAA",
      "blob:https://example.com/id",
      "api/trpc",
    ]) {
      expect(addBasePath(url)).toBe(url);
    }
  });

  it("strips the prefix from a path the browser reports", async () => {
    const { stripBasePath } = await basePath("/norish");

    expect(stripBasePath("/norish")).toBe("/");
    expect(stripBasePath("/norish/settings")).toBe("/settings");
    expect(stripBasePath("/norish-other")).toBe("/norish-other");
  });
});

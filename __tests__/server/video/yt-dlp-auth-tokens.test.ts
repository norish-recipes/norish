// @vitest-environment node
import type { SiteAuthTokenDecryptedDto } from "@/types/dto/site-auth-tokens";

import fs from "node:fs/promises";
import fsSync from "node:fs";

import { describe, it, expect, afterEach, vi } from "vitest";

vi.mock("yt-dlp-wrap", () => ({
  default: class MockYTDlpWrap {
    constructor() {}
  },
}));
vi.mock("@/server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  videoLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/config/server-config-loader", () => ({
  getVideoConfig: vi.fn().mockReturnValue({ ytDlpVersion: "latest" }),
}));

import { buildAuthArgs } from "@/server/video/yt-dlp";

function makeToken(overrides: Partial<SiteAuthTokenDecryptedDto>): SiteAuthTokenDecryptedDto {
  return {
    id: "test-id",
    userId: "test-user",
    domain: "example.com",
    name: "Authorization",
    value: "Bearer token123",
    type: "header",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("buildAuthArgs", () => {
  const cookieFilePaths: string[] = [];

  afterEach(async () => {
    for (const p of cookieFilePaths) {
      await fs.unlink(p).catch(() => {});
    }
    cookieFilePaths.length = 0;
  });

  it("should produce --add-header args for a header token", async () => {
    const tokens = [makeToken({ name: "Authorization", value: "Bearer abc123", type: "header" })];
    const { args, cleanup } = await buildAuthArgs(tokens, "https://example.com/video");

    expect(args).toEqual(["--add-header", "Authorization: Bearer abc123"]);
    await cleanup();
  });

  it("should produce multiple --add-header pairs for multiple header tokens", async () => {
    const tokens = [
      makeToken({ id: "t1", name: "Authorization", value: "Bearer abc", type: "header" }),
      makeToken({ id: "t2", name: "X-Custom", value: "custom-value", type: "header" }),
    ];
    const { args, cleanup } = await buildAuthArgs(tokens, "https://example.com/video");

    expect(args).toEqual([
      "--add-header",
      "Authorization: Bearer abc",
      "--add-header",
      "X-Custom: custom-value",
    ]);
    await cleanup();
  });

  it("should write a cookie file and produce --cookies args for cookie tokens", async () => {
    const tokens = [makeToken({ name: "session_id", value: "sess123", type: "cookie" })];
    const { args, cleanup } = await buildAuthArgs(tokens, "https://example.com/video");

    expect(args.length).toBe(2);
    expect(args[0]).toBe("--cookies");
    const cookiePath = args[1];

    expect(fsSync.existsSync(cookiePath)).toBe(true);

    cookieFilePaths.push(cookiePath);
    await cleanup();
  });

  it("should write valid Netscape cookie format", async () => {
    const tokens = [
      makeToken({ id: "c1", name: "session_id", value: "sess123", type: "cookie" }),
      makeToken({ id: "c2", name: "auth_tok", value: "authval", type: "cookie" }),
    ];
    const { args, cleanup } = await buildAuthArgs(tokens, "https://www.example.com/video");

    const cookiePath = args[1];
    const content = await fs.readFile(cookiePath, "utf-8");
    const lines = content.split("\n");

    expect(lines[0]).toBe("# Netscape HTTP Cookie File");
    expect(lines[1]).toBe("# https://curl.se/docs/http-cookies.html");
    expect(lines[2]).toBe("");
    expect(lines[3]).toBe("www.example.com\tTRUE\t/\tFALSE\t0\tsession_id\tsess123");
    expect(lines[4]).toBe("www.example.com\tTRUE\t/\tFALSE\t0\tauth_tok\tauthval");

    cookieFilePaths.push(cookiePath);
    await cleanup();
  });

  it("should remove the cookie file on cleanup", async () => {
    const tokens = [makeToken({ name: "session_id", value: "sess123", type: "cookie" })];
    const { args, cleanup } = await buildAuthArgs(tokens, "https://example.com/video");

    const cookiePath = args[1];

    expect(fsSync.existsSync(cookiePath)).toBe(true);

    await cleanup();
    expect(fsSync.existsSync(cookiePath)).toBe(false);
  });

  it("should produce both header and cookie args for mixed tokens", async () => {
    const tokens = [
      makeToken({ id: "h1", name: "Authorization", value: "Bearer abc", type: "header" }),
      makeToken({ id: "c1", name: "session_id", value: "sess123", type: "cookie" }),
    ];
    const { args, cleanup } = await buildAuthArgs(tokens, "https://example.com/video");

    expect(args[0]).toBe("--add-header");
    expect(args[1]).toBe("Authorization: Bearer abc");
    expect(args[2]).toBe("--cookies");
    expect(typeof args[3]).toBe("string");
    expect(fsSync.existsSync(args[3])).toBe(true);

    cookieFilePaths.push(args[3]);
    await cleanup();
  });

  it("should return empty args and a no-op cleanup for empty tokens", async () => {
    const { args, cleanup } = await buildAuthArgs([], "https://example.com/video");

    expect(args).toEqual([]);
    // cleanup should not throw
    await expect(cleanup()).resolves.toBeUndefined();
  });
});

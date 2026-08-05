import { describe, expect, it } from "vitest";

import { isVideoUrl } from "@norish/shared/lib/helpers";

describe("isVideoUrl", () => {
  it.each([
    // YouTube
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/AbCdEf12345",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    // Instagram
    "https://www.instagram.com/reel/Cx1yZ2aB3cD/",
    // TikTok, including the vm./vt. share links
    "https://www.tiktok.com/@cook/video/7211111111111111111",
    "https://vm.tiktok.com/ZMabcdefg/",
    "https://vt.tiktok.com/ZSabcdefg/",
    // Facebook
    "https://www.facebook.com/watch/?v=123456789",
    "https://fb.watch/abcDEF123/",
    // Pinterest, including the app's pin.it share links and regional domains
    "https://www.pinterest.com/pin/1234567890123456789/",
    "https://pin.it/AbCdEfGhI",
    "https://nl.pinterest.com/pin/1234567890123456789/",
    "https://www.pinterest.de/pin/1234567890123456789/",
    // X
    "https://x.com/cook/status/1234567890123456789",
    "https://twitter.com/cook/status/1234567890123456789",
    // Threads
    "https://www.threads.com/@cook/post/Cx1yZ2aB3cD",
    "https://www.threads.net/@cook/post/Cx1yZ2aB3cD",
    // Snapchat
    "https://www.snapchat.com/spotlight/AbCdEfGhIjKl",
    // Vimeo
    "https://vimeo.com/123456789",
    // Dailymotion
    "https://www.dailymotion.com/video/x8abcde",
    "https://dai.ly/x8abcde",
    // Douyin
    "https://www.douyin.com/video/7211111111111111111",
    // Bilibili
    "https://www.bilibili.com/video/BV1abc123def/",
    "https://b23.tv/AbCdEf1",
    // RedNote
    "https://www.xiaohongshu.com/explore/64abcdef000000001f00a1b2",
    "https://xhslink.com/AbCdEf",
  ])("accepts %s", (url) => {
    expect(isVideoUrl(url)).toBe(true);
  });

  it.each([
    "https://www.seriouseats.com/classic-panzanella-salad-recipe",
    "https://cooking.nytimes.com/recipes/1017089-lasagna",
    "https://example.com/watch?v=abc",
  ])("rejects the ordinary webpage %s", (url) => {
    expect(isVideoUrl(url)).toBe(false);
  });

  it.each([
    // Hostname matching is anchored at label boundaries, so lookalike hosts
    // that merely contain a platform name do not become video imports.
    "https://notyoutube.com/watch?v=abc",
    "https://youtube.com.evil.example/watch?v=abc",
    "https://spin.it/abc",
    "https://mytiktok.company.example/video/1",
  ])("rejects the lookalike host %s", (url) => {
    expect(isVideoUrl(url)).toBe(false);
  });

  it("rejects things that are not http(s) URLs at all", () => {
    expect(isVideoUrl("not a url")).toBe(false);
    expect(isVideoUrl("Chocolate cake with 200g flour")).toBe(false);
    expect(isVideoUrl("ftp://youtube.com/watch?v=abc")).toBe(false);
    expect(isVideoUrl("")).toBe(false);
  });
});

// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  isInstagramUrl,
  isFacebookUrl,
  isYouTubeUrl,
  detectPlatform,
} from "@/server/video/url-utils";

describe("URL detection utilities", () => {
  describe("isInstagramUrl", () => {
    it("returns true for instagram.com URLs", () => {
      expect(isInstagramUrl("https://www.instagram.com/p/ABC123/")).toBe(true);
      expect(isInstagramUrl("https://instagram.com/reel/ABC123/")).toBe(true);
    });

    it("returns false for non-Instagram URLs", () => {
      expect(isInstagramUrl("https://www.youtube.com/watch?v=ABC123")).toBe(false);
      expect(isInstagramUrl("https://facebook.com/video/123")).toBe(false);
    });

    it("returns false for invalid URLs", () => {
      expect(isInstagramUrl("not-a-url")).toBe(false);
      expect(isInstagramUrl("")).toBe(false);
    });
  });

  describe("isFacebookUrl", () => {
    it("returns true for facebook.com URLs", () => {
      expect(isFacebookUrl("https://www.facebook.com/watch?v=123")).toBe(true);
      expect(isFacebookUrl("https://facebook.com/video/123")).toBe(true);
    });

    it("returns true for fb.watch URLs", () => {
      expect(isFacebookUrl("https://fb.watch/ABC123/")).toBe(true);
    });

    it("returns false for non-Facebook URLs", () => {
      expect(isFacebookUrl("https://www.youtube.com/watch?v=ABC123")).toBe(false);
      expect(isFacebookUrl("https://instagram.com/p/ABC123/")).toBe(false);
    });

    it("returns false for invalid URLs", () => {
      expect(isFacebookUrl("not-a-url")).toBe(false);
      expect(isFacebookUrl("")).toBe(false);
    });
  });

  describe("isYouTubeUrl", () => {
    it("returns true for youtube.com URLs", () => {
      expect(isYouTubeUrl("https://www.youtube.com/watch?v=ABC123")).toBe(true);
      expect(isYouTubeUrl("https://youtube.com/shorts/ABC123")).toBe(true);
    });

    it("returns true for youtu.be URLs", () => {
      expect(isYouTubeUrl("https://youtu.be/ABC123")).toBe(true);
    });

    it("returns false for non-YouTube URLs", () => {
      expect(isYouTubeUrl("https://www.facebook.com/video/123")).toBe(false);
      expect(isYouTubeUrl("https://instagram.com/p/ABC123/")).toBe(false);
    });

    it("returns false for invalid URLs", () => {
      expect(isYouTubeUrl("not-a-url")).toBe(false);
      expect(isYouTubeUrl("")).toBe(false);
    });
  });

  describe("detectPlatform", () => {
    it("detects Instagram URLs", () => {
      expect(detectPlatform("https://www.instagram.com/p/ABC123/")).toBe("instagram");
    });

    it("detects Facebook URLs", () => {
      expect(detectPlatform("https://www.facebook.com/watch?v=123")).toBe("facebook");
      expect(detectPlatform("https://fb.watch/ABC123/")).toBe("facebook");
    });

    it("detects YouTube URLs", () => {
      expect(detectPlatform("https://www.youtube.com/watch?v=ABC123")).toBe("youtube");
      expect(detectPlatform("https://youtu.be/ABC123")).toBe("youtube");
    });

    it("returns generic for unknown platforms", () => {
      expect(detectPlatform("https://www.tiktok.com/@user/video/123")).toBe("generic");
      expect(detectPlatform("https://vimeo.com/123456")).toBe("generic");
    });

    it("throws for invalid URLs", () => {
      expect(() => detectPlatform("not-a-url")).toThrow();
      expect(() => detectPlatform("")).toThrow();
    });
  });
});

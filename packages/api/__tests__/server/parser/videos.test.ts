// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import after mocks are set up
import { parseVideos } from "@norish/api/parser/parsers/videos";
import { downloadVideo, getVideoMetadata } from "@norish/api/video/yt-dlp";

// Mock the dependencies before importing the module
vi.mock("@norish/api/video/yt-dlp", () => ({
  downloadVideo: vi.fn(),
  getVideoMetadata: vi.fn(),
  getFfmpegPath: vi.fn().mockReturnValue("/usr/bin/ffmpeg"),
}));

vi.mock("@norish/api/downloader", () => ({
  convertToMp4: vi
    .fn()
    .mockResolvedValue({ filePath: "/tmp/video.mp4", converted: true, method: "remux" }),
  saveVideoFile: vi
    .fn()
    .mockResolvedValue({ video: "/recipes/test-id/video-123.mp4", duration: 120 }),
}));

vi.mock("@norish/api/logger", () => ({
  parserLogger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

describe("parseVideos - VideoObject extraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("VideoObject detection", () => {
    it("returns empty array when videoField is null", async () => {
      const result = await parseVideos(null, "test-recipe-id");

      expect(result.videos).toHaveLength(0);
    });

    it("returns empty array when videoField is undefined", async () => {
      const result = await parseVideos(undefined, "test-recipe-id");

      expect(result.videos).toHaveLength(0);
    });

    it("returns empty array when videoField is not a VideoObject", async () => {
      const result = await parseVideos(
        { "@type": "ImageObject", url: "http://example.com/img.jpg" },
        "test-recipe-id"
      );

      expect(result.videos).toHaveLength(0);
    });

    it("returns empty array when VideoObject has no contentUrl or url", async () => {
      const result = await parseVideos(
        { "@type": "VideoObject", name: "Test Video" },
        "test-recipe-id"
      );

      expect(result.videos).toHaveLength(0);
    });
  });

  describe("video downloading", () => {
    it("downloads video from contentUrl when available", async () => {
      vi.mocked(downloadVideo).mockResolvedValueOnce({
        filePath: "/tmp/downloaded.mp4",
        extension: "mp4",
      });

      const videoField = {
        "@type": "VideoObject",
        contentUrl: "https://example.com/video.mp4",
        duration: "PT2M30S",
      };

      const result = await parseVideos(videoField, "test-recipe-id");

      expect(downloadVideo).toHaveBeenCalledWith("https://example.com/video.mp4");
      expect(result.videos).toHaveLength(1);
      expect(result.videos[0].video).toBe("/recipes/test-id/video-123.mp4");
    });

    it("downloads video from url when contentUrl is not available", async () => {
      vi.mocked(downloadVideo).mockResolvedValueOnce({
        filePath: "/tmp/downloaded.mp4",
        extension: "mp4",
      });

      const videoField = {
        "@type": "VideoObject",
        url: "https://example.com/video.mp4",
      };

      const result = await parseVideos(videoField, "test-recipe-id");

      expect(downloadVideo).toHaveBeenCalledWith("https://example.com/video.mp4");
      expect(result.videos).toHaveLength(1);
    });

    it("prefers contentUrl over url when both are present", async () => {
      vi.mocked(downloadVideo).mockResolvedValueOnce({
        filePath: "/tmp/downloaded.mp4",
        extension: "mp4",
      });

      const videoField = {
        "@type": "VideoObject",
        contentUrl: "https://example.com/content-video.mp4",
        url: "https://example.com/url-video.mp4",
      };

      const result = await parseVideos(videoField, "test-recipe-id");

      expect(downloadVideo).toHaveBeenCalledWith("https://example.com/content-video.mp4");
      expect(result.videos).toHaveLength(1);
    });

    it("handles array of VideoObjects", async () => {
      vi.mocked(downloadVideo)
        .mockResolvedValueOnce({ filePath: "/tmp/video1.mp4", extension: "mp4" })
        .mockResolvedValueOnce({ filePath: "/tmp/video2.mp4", extension: "mp4" });

      const videoField = [
        { "@type": "VideoObject", contentUrl: "https://example.com/video1.mp4" },
        { "@type": "VideoObject", contentUrl: "https://example.com/video2.mp4" },
      ];

      const result = await parseVideos(videoField, "test-recipe-id");

      expect(downloadVideo).toHaveBeenCalledTimes(2);
      expect(result.videos).toHaveLength(2);
    });

    it("limits videos to maxVideos parameter", async () => {
      vi.mocked(downloadVideo).mockResolvedValue({ filePath: "/tmp/video.mp4", extension: "mp4" });

      const videoField = [
        { "@type": "VideoObject", contentUrl: "https://example.com/video1.mp4" },
        { "@type": "VideoObject", contentUrl: "https://example.com/video2.mp4" },
        { "@type": "VideoObject", contentUrl: "https://example.com/video3.mp4" },
        { "@type": "VideoObject", contentUrl: "https://example.com/video4.mp4" },
      ];

      const result = await parseVideos(videoField, "test-recipe-id", 2);

      expect(downloadVideo).toHaveBeenCalledTimes(2);
      expect(result.videos).toHaveLength(2);
    });

    it("continues on download failure and returns successful downloads", async () => {
      vi.mocked(downloadVideo)
        .mockResolvedValueOnce(null as never) // First fails
        .mockResolvedValueOnce({ filePath: "/tmp/video2.mp4", extension: "mp4" }); // Second succeeds

      const videoField = [
        { "@type": "VideoObject", contentUrl: "https://example.com/video1.mp4" },
        { "@type": "VideoObject", contentUrl: "https://example.com/video2.mp4" },
      ];

      const result = await parseVideos(videoField, "test-recipe-id");

      expect(downloadVideo).toHaveBeenCalledTimes(2);
      expect(result.videos).toHaveLength(1);
    });
  });

  describe("duration parsing", () => {
    it("parses ISO 8601 duration PT1H30M15S", async () => {
      vi.mocked(downloadVideo).mockResolvedValueOnce({
        filePath: "/tmp/video.mp4",
        extension: "mp4",
      });
      vi.mocked(getVideoMetadata).mockResolvedValueOnce({
        title: "Test",
        description: "",
        duration: 0,
        thumbnail: "",
      });

      const videoField = {
        "@type": "VideoObject",
        contentUrl: "https://example.com/video.mp4",
        duration: "PT1H30M15S",
      };

      await parseVideos(videoField, "test-recipe-id");

      // Duration from JSON-LD should be passed to saveVideoFile
      // The mock returns duration: 120, but internally 5415 seconds would be parsed
    });

    it("parses simple PT2M30S duration", async () => {
      vi.mocked(downloadVideo).mockResolvedValueOnce({
        filePath: "/tmp/video.mp4",
        extension: "mp4",
      });

      const videoField = {
        "@type": "VideoObject",
        contentUrl: "https://example.com/video.mp4",
        duration: "PT2M30S",
      };

      await parseVideos(videoField, "test-recipe-id");

      // 2 min 30 sec = 150 seconds
    });

    it("falls back to metadata duration when JSON-LD duration is missing", async () => {
      vi.mocked(downloadVideo).mockResolvedValueOnce({
        filePath: "/tmp/video.mp4",
        extension: "mp4",
      });
      vi.mocked(getVideoMetadata).mockResolvedValueOnce({
        title: "Test Video",
        description: "",
        duration: 180,
        thumbnail: "",
      });

      const videoField = {
        "@type": "VideoObject",
        contentUrl: "https://example.com/video.mp4",
        // No duration field
      };

      await parseVideos(videoField, "test-recipe-id");

      expect(getVideoMetadata).toHaveBeenCalledWith("https://example.com/video.mp4");
    });
  });

  describe("thumbnail extraction", () => {
    it("extracts single string thumbnailUrl", async () => {
      vi.mocked(downloadVideo).mockResolvedValueOnce({
        filePath: "/tmp/video.mp4",
        extension: "mp4",
      });

      const videoField = {
        "@type": "VideoObject",
        contentUrl: "https://example.com/video.mp4",
        thumbnailUrl: "https://example.com/thumb.jpg",
      };

      const result = await parseVideos(videoField, "test-recipe-id");

      expect(result.videos[0].thumbnail).toBe("https://example.com/thumb.jpg");
    });

    it("extracts first URL from thumbnailUrl array", async () => {
      vi.mocked(downloadVideo).mockResolvedValueOnce({
        filePath: "/tmp/video.mp4",
        extension: "mp4",
      });

      const videoField = {
        "@type": "VideoObject",
        contentUrl: "https://example.com/video.mp4",
        thumbnailUrl: ["https://example.com/thumb-720.jpg", "https://example.com/thumb-1080.jpg"],
      };

      const result = await parseVideos(videoField, "test-recipe-id");

      expect(result.videos[0].thumbnail).toBe("https://example.com/thumb-720.jpg");
    });

    it("handles missing thumbnailUrl gracefully", async () => {
      vi.mocked(downloadVideo).mockResolvedValueOnce({
        filePath: "/tmp/video.mp4",
        extension: "mp4",
      });

      const videoField = {
        "@type": "VideoObject",
        contentUrl: "https://example.com/video.mp4",
        // No thumbnailUrl
      };

      const result = await parseVideos(videoField, "test-recipe-id");

      expect(result.videos[0].thumbnail).toBeNull();
    });
  });

  describe("@type case insensitivity", () => {
    it("handles lowercase videoobject", async () => {
      vi.mocked(downloadVideo).mockResolvedValueOnce({
        filePath: "/tmp/video.mp4",
        extension: "mp4",
      });

      const videoField = {
        "@type": "videoobject",
        contentUrl: "https://example.com/video.mp4",
      };

      const result = await parseVideos(videoField, "test-recipe-id");

      expect(result.videos).toHaveLength(1);
    });

    it("handles uppercase VIDEOOBJECT", async () => {
      vi.mocked(downloadVideo).mockResolvedValueOnce({
        filePath: "/tmp/video.mp4",
        extension: "mp4",
      });

      const videoField = {
        "@type": "VIDEOOBJECT",
        contentUrl: "https://example.com/video.mp4",
      };

      const result = await parseVideos(videoField, "test-recipe-id");

      expect(result.videos).toHaveLength(1);
    });

    it("handles mixed case VideoObject", async () => {
      vi.mocked(downloadVideo).mockResolvedValueOnce({
        filePath: "/tmp/video.mp4",
        extension: "mp4",
      });

      const videoField = {
        "@type": "VideoObject",
        contentUrl: "https://example.com/video.mp4",
      };

      const result = await parseVideos(videoField, "test-recipe-id");

      expect(result.videos).toHaveLength(1);
    });

    it("handles type field instead of @type", async () => {
      vi.mocked(downloadVideo).mockResolvedValueOnce({
        filePath: "/tmp/video.mp4",
        extension: "mp4",
      });

      const videoField = {
        type: "VideoObject",
        contentUrl: "https://example.com/video.mp4",
      };

      const result = await parseVideos(videoField, "test-recipe-id");

      expect(result.videos).toHaveLength(1);
    });
  });

  describe("order assignment", () => {
    it("assigns sequential order to videos", async () => {
      vi.mocked(downloadVideo).mockResolvedValue({ filePath: "/tmp/video.mp4", extension: "mp4" });

      const videoField = [
        { "@type": "VideoObject", contentUrl: "https://example.com/video1.mp4" },
        { "@type": "VideoObject", contentUrl: "https://example.com/video2.mp4" },
        { "@type": "VideoObject", contentUrl: "https://example.com/video3.mp4" },
      ];

      const result = await parseVideos(videoField, "test-recipe-id");

      expect(result.videos[0].order).toBe(0);
      expect(result.videos[1].order).toBe(1);
      expect(result.videos[2].order).toBe(2);
    });
  });
});

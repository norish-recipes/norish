// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import after mocks are set up
import { extractPageVideos, parseVideos } from "@norish/api/parser/parsers/videos";
import { downloadVideo, getVideoMetadata } from "@norish/api/video/yt-dlp";
import { getPageRenderersConfig } from "@norish/shared-server/config/server-config-loader";
import { isRefusedHost } from "@norish/shared-server/private-addresses";

// Mock the dependencies before importing the module
vi.mock("@norish/api/video/yt-dlp", () => ({
  downloadVideo: vi.fn(),
  getVideoMetadata: vi.fn(),
  getMaxVideoLengthSeconds: vi.fn().mockResolvedValue(600),
  getFfmpegPath: vi.fn().mockReturnValue("/usr/bin/ffmpeg"),
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getPageRenderersConfig: vi.fn().mockResolvedValue({ allowPrivateAddresses: false }),
}));

vi.mock("@norish/shared-server/private-addresses", () => ({
  isRefusedHost: vi.fn().mockResolvedValue(false),
}));

vi.mock("@norish/shared-server/media/storage", () => ({
  convertToMp4: vi
    .fn()
    .mockResolvedValue({ filePath: "/tmp/video.mp4", converted: true, method: "remux" }),
  saveVideoFile: vi
    .fn()
    .mockResolvedValue({ video: "/recipes/test-id/video-123.mp4", duration: 120 }),
}));

vi.mock("@norish/shared-server/logger", () => ({
  parserLogger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

describe("extractPageVideos", () => {
  const PAGE = "https://example.com/recipes/pesto";

  it("finds embedded videos, absolute and once each", () => {
    expect(
      extractPageVideos(
        `<head>
           <meta property="og:video" content="https://cdn.test/og.mp4">
           <meta property="og:video:secure_url" content="https://cdn.test/secure.mp4">
           <meta property="og:video:type" content="video/mp4">
         </head>
         <body>
           <video src="/media/own.mp4"></video>
           <video><source src="https://cdn.test/source.webm"></video>
           <iframe src="https://www.youtube.com/embed/abc"></iframe>
           <iframe data-src="https://player.vimeo.com/video/1"></iframe>
           <iframe src="https://www.youtube.com/embed/abc"></iframe>
         </body>`,
        PAGE
      )
    ).toEqual([
      "https://cdn.test/og.mp4",
      "https://cdn.test/secure.mp4",
      "https://example.com/media/own.mp4",
      "https://cdn.test/source.webm",
      "https://www.youtube.com/embed/abc",
      "https://player.vimeo.com/video/1",
    ]);
  });

  it("leaves out what is not a web address", () => {
    expect(
      extractPageVideos(
        `<iframe src="about:blank"></iframe><iframe></iframe><video src="file:///etc/passwd"></video>
         <iframe src="javascript:alert(1)"></iframe>`,
        PAGE
      )
    ).toEqual([]);
  });

  it("caps the list a model reads", () => {
    const frames = Array.from({ length: 30 }, (_, i) => `<iframe src="/f/${i}"></iframe>`).join("");

    expect(extractPageVideos(frames, PAGE)).toHaveLength(10);
  });
});

describe("parseVideos - what may be downloaded", () => {
  const video = (contentUrl: string) => ({ "@type": "VideoObject", contentUrl });

  beforeEach(() => {
    vi.mocked(downloadVideo).mockReset();
    vi.mocked(getVideoMetadata).mockResolvedValue({ duration: 10 } as never);
    vi.mocked(isRefusedHost).mockReset();
    vi.mocked(isRefusedHost).mockResolvedValue(false);
  });

  it("never saves a video over the maximum length, whatever the page says", async () => {
    vi.mocked(getVideoMetadata).mockResolvedValue({ duration: 7200 } as never);

    const { videos } = await parseVideos(
      { ...video("https://cdn.test/long.mp4"), duration: "PT1M" },
      "recipe-1"
    );

    expect(videos).toEqual([]);
    expect(downloadVideo).not.toHaveBeenCalled();
  });

  it("never downloads from a private address", async () => {
    vi.mocked(isRefusedHost).mockResolvedValue(true);

    const { videos } = await parseVideos(video("http://192.168.1.1/admin"), "recipe-1");

    expect(videos).toEqual([]);
    expect(isRefusedHost).toHaveBeenCalledWith("192.168.1.1", false);
    expect(downloadVideo).not.toHaveBeenCalled();
    expect(getVideoMetadata).not.toHaveBeenCalledWith("http://192.168.1.1/admin");
  });

  it("follows the administrator's Allow private addresses", async () => {
    vi.mocked(getPageRenderersConfig).mockResolvedValueOnce({
      allowPrivateAddresses: true,
    } as never);
    vi.mocked(downloadVideo).mockRejectedValue(new Error("stop here"));

    await parseVideos(video("http://192.168.1.1/v.mp4"), "recipe-1");

    expect(isRefusedHost).toHaveBeenCalledWith("192.168.1.1", true);
    expect(downloadVideo).toHaveBeenCalledOnce();
  });

  it.each(["file:///etc/passwd", "--exec=boom", "not a url"])("refuses %s", async (url) => {
    await parseVideos(video(url), "recipe-1");

    expect(downloadVideo).not.toHaveBeenCalled();
  });
});

describe("parseVideos - VideoObject extraction", () => {
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

    it("saves only the first video of an array", async () => {
      vi.mocked(downloadVideo)
        .mockResolvedValueOnce({ filePath: "/tmp/video1.mp4", extension: "mp4" })
        .mockResolvedValueOnce({ filePath: "/tmp/video2.mp4", extension: "mp4" });

      const videoField = [
        { "@type": "VideoObject", contentUrl: "https://example.com/video1.mp4" },
        { "@type": "VideoObject", contentUrl: "https://example.com/video2.mp4" },
      ];

      const result = await parseVideos(videoField, "test-recipe-id");

      expect(downloadVideo).toHaveBeenCalledTimes(1);
      expect(downloadVideo).toHaveBeenCalledWith("https://example.com/video1.mp4");
      expect(result.videos).toHaveLength(1);
    });

    it("tries the next candidate when one fails, and tries only a few", async () => {
      vi.mocked(downloadVideo).mockReset();
      vi.mocked(downloadVideo).mockRejectedValue(new Error("gone"));

      const candidates = [1, 2, 3, 4].map((n) => ({
        "@type": "VideoObject",
        contentUrl: `https://cdn.test/${n}.mp4`,
      }));
      const result = await parseVideos(candidates, "test-recipe-id");

      expect(result.videos).toEqual([]);
      expect(downloadVideo).toHaveBeenCalledTimes(3);
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
        videoStream: "present",
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
        videoStream: "present",
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
    it("gives the saved video the first place", async () => {
      vi.mocked(downloadVideo).mockResolvedValue({ filePath: "/tmp/video.mp4", extension: "mp4" });

      const result = await parseVideos(
        { "@type": "VideoObject", contentUrl: "https://example.com/video1.mp4" },
        "test-recipe-id"
      );

      expect(result.videos[0]?.order).toBe(0);
    });
  });
});

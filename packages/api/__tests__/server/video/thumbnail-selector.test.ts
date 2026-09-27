// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  generateStructured: vi.fn(),
  isAIEnabled: vi.fn(),
  getFfmpegPath: vi.fn(),
  saveImageBytes: vi.fn(),
  downloadImage: vi.fn(),
  execFileAsync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => {
    const callback = args[args.length - 1];
    if (typeof callback === "function") {
      callback(null, { stdout: "", stderr: "" });
    }
  },
}));

vi.mock("@norish/api/video/yt-dlp", () => ({
  getFfmpegPath: mocked.getFfmpegPath,
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isAIEnabled: mocked.isAIEnabled,
}));

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({
  generateStructured: mocked.generateStructured,
}));

vi.mock("@norish/shared-server/media/storage", () => ({
  saveImageBytes: mocked.saveImageBytes,
  downloadImage: mocked.downloadImage,
}));

const logger = vi.hoisted(() => {
  const silent = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() };
  silent.child.mockReturnValue(silent);
  return silent;
});

vi.mock("@norish/shared-server/logger", () => ({
  videoLogger: logger,
}));

import {
  calculateCandidateTimestamps,
  createFrameCollage,
  selectAndSaveVideoThumbnail,
  selectBestFrameWithVision,
} from "@norish/api/video/thumbnail-selector";

describe("calculateCandidateTimestamps", () => {
  it("returns default timestamps when duration is unknown or zero", () => {
    const timestamps = calculateCandidateTimestamps(0, 9);
    expect(timestamps).toEqual([1.5, 4, 8, 15, 25, 40, 55, 75, 95]);
    expect(calculateCandidateTimestamps(null, 5)).toEqual([1.5, 4, 8, 15, 25]);
  });

  it("samples hook frames, mid-point, and plating reveal frames across the video", () => {
    const timestamps = calculateCandidateTimestamps(60, 9);
    expect(timestamps).toHaveLength(9);
    // Hook frames in first 15% (1.5s, 3.5s, 6.5s)
    expect(timestamps[0]).toBe(1.5);
    expect(timestamps[1]).toBe(3.5);
    expect(timestamps[2]).toBe(6.5);
    // Mid-cooking frame around 42% (25.2s)
    expect(timestamps[3]).toBe(25.2);
    // Plating reveal frames in 65%-96% (39s - 57.6s)
    expect(timestamps[8]).toBe(57.6);
    // All timestamps in strictly ascending order
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]!).toBeGreaterThan(timestamps[i - 1]!);
    }
  });

  it("handles short videos under 8 seconds gracefully", () => {
    const timestamps = calculateCandidateTimestamps(4, 5);
    expect(timestamps).toHaveLength(5);
    for (const ts of timestamps) {
      expect(ts).toBeGreaterThan(0);
      expect(ts).toBeLessThan(4);
    }
  });
});

describe("selectBestFrameWithVision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the 1-based index selected by AI", async () => {
    mocked.generateStructured.mockResolvedValue({
      selectedFrame: 4,
      reasoning: "Clear plated dish presentation.",
    });

    const fakeCollage = Buffer.from("fake-jpeg-bytes");
    const result = await selectBestFrameWithVision(fakeCollage, 9, "Creamy Garlic Pasta");

    expect(result).toBe(4);
    expect(mocked.generateStructured).toHaveBeenCalledWith({
      prompt: "video-thumbnail-selection",
      schema: expect.anything(),
      images: [{ data: fakeCollage.toString("base64"), mimeType: "image/jpeg" }],
      sections: ["Recipe Title: Creamy Garlic Pasta"],
    });
  });

  it("returns null if selected frame index is out of bounds", async () => {
    mocked.generateStructured.mockResolvedValue({
      selectedFrame: 15,
      reasoning: "Invalid",
    });

    const fakeCollage = Buffer.from("fake-jpeg-bytes");
    const result = await selectBestFrameWithVision(fakeCollage, 9);

    expect(result).toBeNull();
  });

  it("returns null if AI call fails", async () => {
    mocked.generateStructured.mockRejectedValue(new Error("AI provider rate limited"));

    const fakeCollage = Buffer.from("fake-jpeg-bytes");
    const result = await selectBestFrameWithVision(fakeCollage, 9);

    expect(result).toBeNull();
  });
});

describe("createFrameCollage", () => {
  it("generates a composite collage buffer using sharp", async () => {
    const sharp = (await import("sharp")).default;
    // Create 4 dummy solid color images for test
    const dummyBuffers = await Promise.all(
      [1, 2, 3, 4].map((i) =>
        sharp({
          create: {
            width: 160,
            height: 90,
            channels: 3,
            background: { r: i * 50, g: 100, b: 150 },
          },
        })
          .jpeg()
          .toBuffer()
      )
    );

    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");

    const tempDir = path.join(os.tmpdir(), `test-collage-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      const frames = await Promise.all(
        dummyBuffers.map(async (buf, idx) => {
          const filePath = path.join(tempDir, `frame-${idx + 1}.jpg`);
          await fs.writeFile(filePath, buf);
          return { index: idx + 1, timestamp: idx * 10, filePath };
        })
      );

      const collage = await createFrameCollage(frames);
      expect(collage).toBeInstanceOf(Buffer);
      expect(collage.length).toBeGreaterThan(0);

      const metadata = await sharp(collage).metadata();
      // 4 landscape frames in a 2x2 grid
      expect(metadata.width).toBeGreaterThan(0);
      expect(metadata.height).toBeGreaterThan(0);
      expect(metadata.format).toBe("jpeg");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("selectAndSaveVideoThumbnail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.getFfmpegPath.mockReturnValue("/usr/bin/ffmpeg");
    mocked.isAIEnabled.mockResolvedValue(true);
    mocked.saveImageBytes.mockResolvedValue("/recipes/recipe-1/thumbnail.jpg");
    mocked.downloadImage.mockResolvedValue("/recipes/recipe-1/downloaded.jpg");
  });

  it("falls back to static URL if ffmpeg is missing", async () => {
    mocked.getFfmpegPath.mockReturnValue(null);

    const result = await selectAndSaveVideoThumbnail({
      videoPath: "/temp/video.mp4",
      recipeId: "recipe-1",
      fallbackThumbnailUrl: "https://example.com/thumb.jpg",
    });

    expect(result).toBe("/recipes/recipe-1/downloaded.jpg");
    expect(mocked.downloadImage).toHaveBeenCalledWith("https://example.com/thumb.jpg", "recipe-1");
  });
});

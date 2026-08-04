// @vitest-environment node
/**
 * What the Instagram processor decides, asked at its entry point.
 *
 * #513: classification asked yt-dlp for a duration and read its absence as "no
 * video", so on some yt-dlp versions every reel took the caption-only path -
 * losing the video and the creator, and failing outright on reels whose caption
 * is not a whole recipe.
 *
 * The fix names the third answer. A post yt-dlp said nothing about is an
 * Unclassified Post, it takes the video path, and it falls back to the caption
 * only when the media itself could not be had. A transcription or AI failure
 * must surface as the failure it is: degrading to a caption-only recipe would
 * hand the user a thin recipe with no signal that their provider is down -
 * the same silent-degradation shape as the bug being fixed.
 *
 * This is the only seam that can express that narrowing, because the pure
 * helpers underneath it do not throw.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { VideoMetadata } from "@norish/api/video/types";
import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import { MediaUnavailableError } from "@norish/api/video/errors";
import { InstagramProcessor } from "@norish/api/video/processors/instagram";

/** Every boundary the processor reaches through, and nothing else. */
const boundary = vi.hoisted(() => ({
  getVideoMetadata: vi.fn(),
  validateVideoLength: vi.fn(),
  downloadVideo: vi.fn(),
  downloadVideoAudio: vi.fn(),
  convertToMp4: vi.fn(),
  saveVideoFile: vi.fn(),
  downloadImage: vi.fn(),
  transcribeAudio: vi.fn(),
  extractRecipeFromVideo: vi.fn(),
  extractRecipeWithAI: vi.fn(),
  fetchViaPlaywright: vi.fn(),
}));

vi.mock("@norish/api/video/yt-dlp", () => ({
  getVideoMetadata: boundary.getVideoMetadata,
  validateVideoLength: boundary.validateVideoLength,
  downloadVideo: boundary.downloadVideo,
  downloadVideoAudio: boundary.downloadVideoAudio,
  getFfmpegPath: () => null,
}));

vi.mock("@norish/shared-server/media/storage", () => ({
  convertToMp4: boundary.convertToMp4,
  saveVideoFile: boundary.saveVideoFile,
  downloadImage: boundary.downloadImage,
}));

vi.mock("@norish/api/ai/transcriber", () => ({ transcribeAudio: boundary.transcribeAudio }));
vi.mock("@norish/api/video/normalizer", () => ({
  extractRecipeFromVideo: boundary.extractRecipeFromVideo,
}));
vi.mock("@norish/api/ai/recipe-parser", () => ({
  extractRecipeWithAI: boundary.extractRecipeWithAI,
}));
vi.mock("@norish/api/parser/fetch", () => ({ fetchViaPlaywright: boundary.fetchViaPlaywright }));
vi.mock("@norish/api/video/cleanup", () => ({ cleanupFile: vi.fn() }));
vi.mock("@norish/shared-server/logger", () => ({
  videoLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const URL_UNDER_TEST = "https://www.instagram.com/reel/ABC123/";
const RECIPE_ID = "recipe-1";

/** A caption long enough to clear the image-post floor but not the video one. */
const SHORT_CAPTION = "A quick pasta with garlic, chilli and a lot of good olive oil.";

/** A caption the video path will try before reaching for the audio. */
const LONG_CAPTION = `${SHORT_CAPTION} `.repeat(6);

function metadata(over: Partial<VideoMetadata>): VideoMetadata {
  return {
    title: "Pasta reel",
    description: "",
    duration: 0,
    thumbnail: "",
    videoStream: "unknown",
    ...over,
  };
}

/** A fresh recipe per call - the processor writes images onto what it gets. */
function recipe(): FullRecipeInsertDTO {
  return { name: "Pasta" } as FullRecipeInsertDTO;
}

function process() {
  return new InstagramProcessor().process({ url: URL_UNDER_TEST, recipeId: RECIPE_ID });
}

/** The media downloads and converts cleanly. */
function mediaIsAvailable() {
  boundary.validateVideoLength.mockResolvedValue(undefined);
  boundary.downloadVideo.mockResolvedValue({ filePath: "/tmp/v.mp4", extension: ".mp4" });
  boundary.convertToMp4.mockResolvedValue({
    filePath: "/tmp/v.mp4",
    converted: false,
    method: "none",
  });
  boundary.saveVideoFile.mockResolvedValue({ video: "recipes/recipe-1/v.mp4", duration: 47 });
}

beforeEach(() => {
  vi.clearAllMocks();
  mediaIsAvailable();
  boundary.downloadImage.mockResolvedValue("recipes/recipe-1/thumb.jpg");
});

describe("a post yt-dlp reports a video stream for", () => {
  it("takes the video path and keeps the video", async () => {
    boundary.getVideoMetadata.mockResolvedValue(
      metadata({ videoStream: "present", duration: 47, description: LONG_CAPTION })
    );
    boundary.extractRecipeFromVideo.mockResolvedValue({ success: true, data: recipe() });

    const result = await process();

    expect(result.videos).toEqual([{ video: "recipes/recipe-1/v.mp4", duration: 47, order: 0 }]);
    expect(boundary.extractRecipeWithAI).not.toHaveBeenCalled();
  });

  it("takes it even when yt-dlp reported no duration", async () => {
    // The exact reported case: a reel with a video stream and no duration.
    boundary.getVideoMetadata.mockResolvedValue(
      metadata({ videoStream: "present", duration: 0, description: LONG_CAPTION })
    );
    boundary.extractRecipeFromVideo.mockResolvedValue({ success: true, data: recipe() });

    await process();

    expect(boundary.downloadVideo).toHaveBeenCalled();
  });
});

describe("a post yt-dlp reports no video stream for", () => {
  it("imports from its caption without touching the video path", async () => {
    boundary.getVideoMetadata.mockResolvedValue(
      metadata({ videoStream: "absent", description: SHORT_CAPTION })
    );
    boundary.extractRecipeWithAI.mockResolvedValue({ success: true, data: recipe() });

    const result = await process();

    expect(result.name).toBe("Pasta");
    expect(boundary.validateVideoLength).not.toHaveBeenCalled();
    expect(boundary.downloadVideo).not.toHaveBeenCalled();
  });
});

describe("an Unclassified Post", () => {
  it("attempts the video path", async () => {
    boundary.getVideoMetadata.mockResolvedValue(
      metadata({ videoStream: "unknown", description: LONG_CAPTION })
    );
    boundary.extractRecipeFromVideo.mockResolvedValue({ success: true, data: recipe() });

    const result = await process();

    expect(result.videos).toEqual([{ video: "recipes/recipe-1/v.mp4", duration: 47, order: 0 }]);
    expect(boundary.extractRecipeWithAI).not.toHaveBeenCalled();
  });

  it("falls back to the caption when there was no media to download", async () => {
    boundary.getVideoMetadata.mockResolvedValue(metadata({ videoStream: "unknown" }));
    boundary.downloadVideo.mockRejectedValue(new MediaUnavailableError("Video unavailable"));
    boundary.downloadVideoAudio.mockRejectedValue(new MediaUnavailableError("Video unavailable"));
    boundary.fetchViaPlaywright.mockResolvedValue(
      `<meta property="og:description" content="${SHORT_CAPTION}" />`
    );
    boundary.extractRecipeWithAI.mockResolvedValue({ success: true, data: recipe() });

    const result = await process();

    expect(result.name).toBe("Pasta");
    expect(boundary.transcribeAudio).not.toHaveBeenCalled();
  });

  it("falls back to the caption when the video was too long to accept", async () => {
    boundary.getVideoMetadata.mockResolvedValue(metadata({ videoStream: "unknown" }));
    boundary.validateVideoLength.mockRejectedValue(
      new MediaUnavailableError("Video exceeds maximum length of 2:00 (actual: 9:13)")
    );
    boundary.fetchViaPlaywright.mockResolvedValue(
      `<meta property="og:description" content="${SHORT_CAPTION}" />`
    );
    boundary.extractRecipeWithAI.mockResolvedValue({ success: true, data: recipe() });

    await expect(process()).resolves.toMatchObject({ name: "Pasta" });
  });

  it("fails the import when transcription fails", async () => {
    boundary.getVideoMetadata.mockResolvedValue(metadata({ videoStream: "unknown" }));
    boundary.downloadVideoAudio.mockResolvedValue("/tmp/a.mp3");
    boundary.transcribeAudio.mockResolvedValue({
      success: false,
      error: "Transcription provider unreachable",
    });

    await expect(process()).rejects.toThrow("Transcription provider unreachable");
    expect(boundary.extractRecipeWithAI).not.toHaveBeenCalled();
  });

  it("fails the import when the AI provider fails", async () => {
    boundary.getVideoMetadata.mockResolvedValue(metadata({ videoStream: "unknown" }));
    boundary.downloadVideoAudio.mockResolvedValue("/tmp/a.mp3");
    boundary.transcribeAudio.mockResolvedValue({ success: true, data: "first, boil the water" });
    boundary.extractRecipeFromVideo.mockResolvedValue({
      success: false,
      error: "AI provider returned an error",
    });

    await expect(process()).rejects.toThrow("AI provider returned an error");
    expect(boundary.extractRecipeWithAI).not.toHaveBeenCalled();
  });
});

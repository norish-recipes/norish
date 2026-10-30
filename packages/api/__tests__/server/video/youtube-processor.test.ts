// @vitest-environment node
/**
 * When the YouTube processor falls back from captions to transcription (#645):
 * only when the captions held no usable recipe, never when the AI provider
 * itself refused, which a transcription would only ask again.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import { YouTubeProcessor } from "@norish/api/video/processors/youtube";
import { AIProviderError, AIResponseError } from "@norish/shared-server/ai/runtime/errors";

const boundary = vi.hoisted(() => ({
  getVideoMetadata: vi.fn(),
  downloadVideoAudio: vi.fn(),
  transcribe: vi.fn(),
  extractRecipeFromVideo: vi.fn(),
}));

vi.mock("@norish/api/video/yt-dlp", () => ({
  getVideoMetadata: boundary.getVideoMetadata,
  validateVideoLength: vi.fn(),
  downloadVideo: vi.fn().mockResolvedValue({ filePath: "/tmp/v.mp4", extension: ".mp4" }),
  downloadVideoAudio: boundary.downloadVideoAudio,
  downloadCaptions: vi.fn().mockResolvedValue({ found: false }),
  parseVttFile: vi.fn(),
  getFfmpegPath: () => null,
}));

vi.mock("@norish/shared-server/media/storage", () => ({
  convertToMp4: vi.fn().mockResolvedValue({ filePath: "/tmp/v.mp4", converted: false }),
  saveVideoFile: vi.fn().mockResolvedValue({ video: "recipes/recipe-1/v.mp4", duration: 47 }),
}));

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({ transcribe: boundary.transcribe }));
vi.mock("@norish/api/video/normalizer", () => ({
  extractRecipeFromVideo: boundary.extractRecipeFromVideo,
}));
vi.mock("@norish/api/video/cleanup", () => ({ cleanupFile: vi.fn() }));
vi.mock("@norish/shared-server/logger", () => ({
  videoLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function process() {
  return new YouTubeProcessor().process({
    url: "https://www.youtube.com/watch?v=abc",
    recipeId: "recipe-1",
  });
}

beforeEach(() => {
  boundary.getVideoMetadata.mockResolvedValue({
    title: "Pasta",
    description: "A quick pasta with garlic, chilli and good olive oil. ".repeat(6),
    duration: 47,
    thumbnail: "",
    videoStream: "present",
  });
  boundary.downloadVideoAudio.mockResolvedValue("/tmp/a.mp3");
  boundary.transcribe.mockResolvedValue("first, boil the water");
});

describe("a caption extraction that fails", () => {
  it("fails the import without transcribing when the AI provider refused", async () => {
    const rateLimited = new AIProviderError("The AI provider rate-limited the request.", {
      retryable: true,
    });

    boundary.extractRecipeFromVideo.mockRejectedValue(rateLimited);

    await expect(process()).rejects.toBe(rateLimited);
    expect(boundary.transcribe).not.toHaveBeenCalled();
  });

  it("falls back to transcription when the captions held no usable recipe", async () => {
    boundary.extractRecipeFromVideo
      .mockRejectedValueOnce(new AIResponseError("missing required fields"))
      .mockResolvedValueOnce({ name: "Pasta" } as FullRecipeInsertDTO);

    await expect(process()).resolves.toMatchObject({ name: "Pasta" });
    expect(boundary.transcribe).toHaveBeenCalledWith("/tmp/a.mp3");
  });
});

describe("a caption recipe without steps", () => {
  const stepless = () => ({ name: "Caption pasta", steps: [] }) as FullRecipeInsertDTO;

  it("transcribes the video for its method", async () => {
    boundary.extractRecipeFromVideo.mockResolvedValueOnce(stepless()).mockResolvedValueOnce({
      name: "Pasta",
      steps: [{ step: "Boil the pasta.", systemUsed: "metric", order: 0 }],
    } as FullRecipeInsertDTO);

    await expect(process()).resolves.toMatchObject({ name: "Pasta" });
    expect(boundary.transcribe).toHaveBeenCalledWith("/tmp/a.mp3");
  });

  it("keeps the caption recipe when transcription fails", async () => {
    boundary.extractRecipeFromVideo.mockResolvedValueOnce(stepless());
    boundary.transcribe.mockRejectedValue(new Error("Transcription provider unreachable"));

    await expect(process()).resolves.toMatchObject({ name: "Caption pasta" });
  });
});

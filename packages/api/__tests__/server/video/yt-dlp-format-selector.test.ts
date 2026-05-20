// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  DOWNLOAD_VIDEO_FORMAT_SELECTOR,
  TRANSCRIPTION_AUDIO_FALLBACKS,
  TRANSCRIPTION_AUDIO_FORMAT,
  TRANSCRIPTION_AUDIO_QUALITY,
} from "@norish/api/video/yt-dlp";

describe("download video format selector", () => {
  it("prioritizes progressive mp4 before DASH-only variants", () => {
    expect(DOWNLOAD_VIDEO_FORMAT_SELECTOR).toBe(
      "best[vcodec^=avc1][ext=mp4]/bestvideo[vcodec^=avc1][ext=mp4]+bestaudio[ext=m4a]/bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]/best[ext=mp4]/best"
    );
  });

  it("keeps compatibility-first fallback ordering", () => {
    const parts = DOWNLOAD_VIDEO_FORMAT_SELECTOR.split("/");

    expect(parts[0]).toBe("best[vcodec^=avc1][ext=mp4]");
    expect(parts[1]).toBe("bestvideo[vcodec^=avc1][ext=mp4]+bestaudio[ext=m4a]");
    expect(parts[2]).toBe("bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]");
    expect(parts[3]).toBe("best[ext=mp4]");
    expect(parts[4]).toBe("best");
  });
});

describe("transcription audio extraction settings", () => {
  it("uses compressed audio instead of WAV for transcription uploads", () => {
    expect(TRANSCRIPTION_AUDIO_FORMAT).toBe("mp3");
    expect(TRANSCRIPTION_AUDIO_QUALITY).toBe("64K");
  });

  it("keeps a safe fallback chain for audio post-processing", () => {
    expect(TRANSCRIPTION_AUDIO_FALLBACKS).toEqual([
      { format: "mp3", quality: "64K" },
      { format: "m4a", quality: "64K" },
      { format: "wav", quality: "0" },
    ]);
  });
});

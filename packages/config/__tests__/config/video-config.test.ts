import { describe, expect, it } from "vitest";

import { VideoConfigSchema } from "@norish/config/zod/server-config";

const base = {
  enabled: true,
  maxLengthSeconds: 120,
  maxVideoFileSize: 100 * 1024 * 1024,
  transcriptionProvider: "generic-openai" as const,
  transcriptionEndpoint: "http://localhost:8000",
  transcriptionModel: "whisper-1",
};

describe("VideoConfigSchema transcription audio format", () => {
  it("leaves a stored config without a format as it was, which means MP3", () => {
    // Every install saved before the setting existed has no format at all.
    expect(VideoConfigSchema.parse(base).transcriptionAudioFormat).toBeUndefined();
  });

  it.each(["mp3", "wav"])("accepts %s", (transcriptionAudioFormat) => {
    expect(
      VideoConfigSchema.parse({ ...base, transcriptionAudioFormat }).transcriptionAudioFormat
    ).toBe(transcriptionAudioFormat);
  });

  it("refuses a format Norish cannot produce", () => {
    expect(() => VideoConfigSchema.parse({ ...base, transcriptionAudioFormat: "flac" })).toThrow();
  });
});

// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { isWebPlayableMp4CodecPair } from "@norish/shared-server/media/storage";

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    UPLOADS_DIR: "/test/uploads",
    MAX_AVATAR_FILE_SIZE: 5 * 1024 * 1024,
    MAX_IMAGE_FILE_SIZE: 10 * 1024 * 1024,
    MAX_VIDEO_FILE_SIZE: 100 * 1024 * 1024,
  },
}));

vi.mock("@norish/config/server-config-loader", () => ({
  getMaxVideoFileSize: vi.fn().mockResolvedValue(100 * 1024 * 1024),
}));

vi.mock("@norish/shared-server/logger", () => ({
  serverLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("sharp", () => ({
  default: vi.fn(),
}));

vi.mock("heic-convert", () => ({
  default: vi.fn(),
}));

describe("isWebPlayableMp4CodecPair", () => {
  it("accepts H.264 video with AAC audio", () => {
    expect(isWebPlayableMp4CodecPair("h264", "aac")).toBe(true);
  });

  it("accepts avc1 video with mp4a audio profile", () => {
    expect(isWebPlayableMp4CodecPair("avc1", "mp4a.40.2")).toBe(true);
  });

  it("accepts silent H.264 video", () => {
    expect(isWebPlayableMp4CodecPair("h264", null)).toBe(true);
  });

  it("rejects HEVC video", () => {
    expect(isWebPlayableMp4CodecPair("hevc", "aac")).toBe(false);
  });

  it("rejects unsupported audio codec in MP4", () => {
    expect(isWebPlayableMp4CodecPair("h264", "opus")).toBe(false);
  });

  it("rejects missing video codec", () => {
    expect(isWebPlayableMp4CodecPair(null, "aac")).toBe(false);
  });
});

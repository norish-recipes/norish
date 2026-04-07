// @vitest-environment node
import { EventEmitter } from "events";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { convertToMp4 } from "@norish/shared-server/media/storage";

const mockState = vi.hoisted(() => ({
  fsStatMock: vi.fn(),
  fsUnlinkMock: vi.fn(),
  fsAccessMock: vi.fn(),
  spawnCalls: [] as Array<{ cmd: string; args: string[] }>,
  spawnMock: vi.fn(),
}));

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

vi.mock("fs/promises", () => ({
  default: {
    stat: mockState.fsStatMock,
    unlink: mockState.fsUnlinkMock,
    access: mockState.fsAccessMock,
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    copyFile: vi.fn(),
    rm: vi.fn(),
    readdir: vi.fn(),
  },
}));

vi.mock("sharp", () => ({
  default: vi.fn(),
}));

vi.mock("heic-convert", () => ({
  default: vi.fn(),
}));

mockState.spawnMock.mockImplementation((cmd: string, args: string[]) => {
  mockState.spawnCalls.push({ cmd, args });

  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };

  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();

  if (args.includes("-print_format")) {
    setImmediate(() => {
      proc.stdout.emit(
        "data",
        Buffer.from(
          JSON.stringify({
            streams: [
              { codec_type: "video", codec_name: "h264" },
              { codec_type: "audio", codec_name: "aac" },
            ],
          })
        )
      );
      proc.emit("close", 0);
    });
  } else {
    setImmediate(() => {
      proc.emit("close", 0);
    });
  }

  return proc;
});

vi.mock("child_process", () => ({
  spawn: mockState.spawnMock,
}));

describe("convertToMp4", () => {
  const normalizePath = (value: string) => value.replaceAll("\\", "/");

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.spawnCalls.length = 0;
    mockState.fsStatMock.mockResolvedValue({ size: 1234 });
    mockState.fsUnlinkMock.mockResolvedValue(undefined);
    mockState.fsAccessMock.mockRejectedValue(new Error("not found"));
  });

  it("keeps browser-compatible mp4 unchanged", async () => {
    const result = await convertToMp4("/tmp/input.mp4", "/usr/bin/ffmpeg");

    expect(result).toEqual({
      filePath: "/tmp/input.mp4",
      converted: false,
      method: "none",
    });
    expect(mockState.spawnCalls).toHaveLength(1);
    expect(mockState.spawnCalls[0].cmd).toContain("ffprobe");
    expect(mockState.fsStatMock).not.toHaveBeenCalled();
  });

  it("remuxes non-mp4 with compatible codecs", async () => {
    const result = await convertToMp4("/tmp/input.mkv", "/usr/bin/ffmpeg");

    expect(result).toEqual({
      filePath: path.join("/tmp", "input.mp4"),
      converted: true,
      method: "remux",
    });
    expect(mockState.spawnCalls).toHaveLength(2);
    expect(mockState.spawnCalls[0].cmd).toContain("ffprobe");
    expect(mockState.spawnCalls[1].cmd).toBe("/usr/bin/ffmpeg");
    expect(mockState.spawnCalls[1].args).toContain("-c");
    expect(mockState.spawnCalls[1].args).toContain("copy");
    expect(normalizePath(mockState.fsUnlinkMock.mock.calls[0][0])).toBe("/tmp/input.mkv");
  });

  it("transcodes mp4 when codecs are not browser-compatible", async () => {
    mockState.spawnMock.mockImplementationOnce((cmd: string, args: string[]) => {
      mockState.spawnCalls.push({ cmd, args });
      const proc = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      setImmediate(() => {
        proc.stdout.emit(
          "data",
          Buffer.from(
            JSON.stringify({
              streams: [
                { codec_type: "video", codec_name: "hevc" },
                { codec_type: "audio", codec_name: "aac" },
              ],
            })
          )
        );
        proc.emit("close", 0);
      });

      return proc;
    });

    const result = await convertToMp4("/tmp/input.mp4", "/usr/bin/ffmpeg");

    expect(result).toEqual({
      filePath: path.join("/tmp", "input-normalized.mp4"),
      converted: true,
      method: "transcode",
    });
    expect(mockState.spawnCalls).toHaveLength(2);
    expect(mockState.spawnCalls[0].cmd).toContain("ffprobe");
    expect(mockState.spawnCalls[1].cmd).toBe("/usr/bin/ffmpeg");
    expect(mockState.spawnCalls[1].args).toContain("libx264");
    expect(mockState.spawnCalls[1].args).toContain("aac");
    expect(normalizePath(mockState.fsUnlinkMock.mock.calls[0][0])).toBe("/tmp/input.mp4");
  });

  it("transcodes when ffprobe fails to return codec info", async () => {
    mockState.spawnMock.mockImplementationOnce((cmd: string, args: string[]) => {
      mockState.spawnCalls.push({ cmd, args });
      const proc = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      setImmediate(() => {
        proc.emit("close", 1);
      });

      return proc;
    });

    const result = await convertToMp4("/tmp/input.webm", "/usr/bin/ffmpeg");

    expect(result).toEqual({
      filePath: path.join("/tmp", "input.mp4"),
      converted: true,
      method: "transcode",
    });
    expect(mockState.spawnCalls).toHaveLength(2);
    expect(mockState.spawnCalls[0].cmd).toContain("ffprobe");
    expect(mockState.spawnCalls[1].cmd).toBe("/usr/bin/ffmpeg");
    expect(mockState.spawnCalls[1].args).toContain("libx264");
  });
});

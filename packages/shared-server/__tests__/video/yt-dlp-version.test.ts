import { describe, expect, it, vi } from "vitest";

import { getYtDlpVersion } from "@norish/shared-server/video/yt-dlp-version";

const { execFile } = vi.hoisted(() => ({ execFile: vi.fn() }));

vi.mock("node:child_process", () => ({ execFile }));
vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: { YT_DLP_BIN_DIR: "/tmp/bin" },
}));
vi.mock("@norish/shared-server/logger", () => ({ videoLogger: { debug: vi.fn() } }));

describe("getYtDlpVersion", () => {
  it("asks the binary once it has one, until then every time", async () => {
    execFile.mockImplementationOnce((_file, _args, _options, callback) =>
      callback(new Error("ENOENT"))
    );
    await expect(getYtDlpVersion()).resolves.toBeNull();

    execFile.mockImplementation((_file, _args, _options, callback) =>
      callback(null, { stdout: "2026.07.04\n", stderr: "" })
    );
    await expect(getYtDlpVersion()).resolves.toBe("2026.07.04");
    await expect(getYtDlpVersion()).resolves.toBe("2026.07.04");

    expect(execFile).toHaveBeenCalledTimes(2);
  });
});

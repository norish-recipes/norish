// @vitest-environment node
import { describe, expect, it } from "vitest";

import { DOWNLOAD_VIDEO_FORMAT_SELECTOR } from "@/server/video/yt-dlp";

describe("download video format selector", () => {
  it("prioritizes progressive mp4 before DASH-only variants", () => {
    expect(DOWNLOAD_VIDEO_FORMAT_SELECTOR).toBe(
      "best[ext=mp4]/bestvideo[vcodec^=avc1][ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best"
    );
  });
});

// @vitest-environment node
/**
 * Reels must not be mistaken for image posts.
 *
 * Reported by a self-hoster (#513): after a yt-dlp upgrade, every Instagram
 * reel started logging "Detected Instagram image post" and took the
 * caption-only path — losing the video and the creator, and failing outright on
 * reels whose caption is not a full recipe — while `yt-dlp <url>` in the same
 * container downloaded the reel fine.
 *
 * The cause is shape, not content: depending on version and extractor path the
 * same reel comes back as the post, as a bare array, or wrapped in a playlist.
 * Only the entry carries duration and uploader, so reading the wrapper produced
 * `duration: 0`, which the old detection read as "image post".
 */
import { describe, expect, it } from "vitest";

import type { YtDlpInfo } from "@norish/api/video/yt-dlp";
import { selectMediaEntry, videoStreamOf } from "@norish/api/video/yt-dlp";

const REEL: YtDlpInfo = {
  title: "Pasta reel",
  duration: 47,
  uploader: "chef",
  thumbnail: "https://cdn/thumb.jpg",
  vcodec: "h264",
  ext: "mp4",
};

const STILL: YtDlpInfo = { title: "Photo", vcodec: "none", ext: "jpg" };

describe("selectMediaEntry", () => {
  it("returns the post itself when yt-dlp answered with a single video", () => {
    expect(selectMediaEntry(REEL)).toBe(REEL);
  });

  it("descends into a playlist wrapper", () => {
    // The shape that broke reels: the wrapper has no duration of its own.
    const wrapper: YtDlpInfo = { title: "Pasta reel", entries: [REEL] };

    expect(selectMediaEntry(wrapper)).toBe(REEL);
    expect(selectMediaEntry(wrapper).duration).toBe(47);
  });

  it("prefers the clip over the stills in a mixed carousel", () => {
    const carousel: YtDlpInfo = { entries: [STILL, STILL, REEL] };

    expect(selectMediaEntry(carousel)).toBe(REEL);
  });

  it("falls back to the first entry when nothing carries video", () => {
    const carousel: YtDlpInfo = { entries: [STILL, STILL] };

    expect(selectMediaEntry(carousel)).toBe(STILL);
  });

  it("leaves an empty playlist alone rather than inventing an entry", () => {
    const empty: YtDlpInfo = { title: "Nothing", entries: [] };

    expect(selectMediaEntry(empty)).toBe(empty);
  });
});

describe("videoStreamOf", () => {
  it("reads vcodec when yt-dlp reports one", () => {
    expect(videoStreamOf({ vcodec: "h264" })).toBe("present");
    expect(videoStreamOf({ vcodec: "none" })).toBe("absent");
  });

  it("falls back to the format list", () => {
    expect(videoStreamOf({ formats: [{ vcodec: "none" }, { vcodec: "vp9" }] })).toBe("present");
    expect(videoStreamOf({ formats: [{ vcodec: "none" }] })).toBe("absent");
  });

  it("falls back to the extension", () => {
    expect(videoStreamOf({ ext: "mp4" })).toBe("present");
    expect(videoStreamOf({ ext: "JPG" })).toBe("absent");
    expect(videoStreamOf({ ext: "webp" })).toBe("absent");
  });

  it("says unknown rather than guessing when yt-dlp reported nothing", () => {
    // The distinction the fix rests on: silence is not evidence of no video.
    expect(videoStreamOf({ title: "Pasta reel", entries: [REEL] })).toBe("unknown");
    expect(videoStreamOf({})).toBe("unknown");
    expect(videoStreamOf({ formats: [] })).toBe("unknown");
  });

  it("ignores formats that report no codec at all", () => {
    expect(videoStreamOf({ formats: [{}, {}] })).toBe("unknown");
  });
});

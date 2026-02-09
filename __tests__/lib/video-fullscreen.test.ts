// @vitest-environment node
import { describe, expect, it } from "vitest";

import { isFullscreenControlSupported } from "@/lib/video-fullscreen";

describe("isFullscreenControlSupported", () => {
  it("returns true when browser supports document fullscreen API", () => {
    const doc = { fullscreenEnabled: true } as Document;

    expect(isFullscreenControlSupported(doc, null)).toBe(true);
  });

  it("returns true on iOS-style native video fullscreen support", () => {
    const doc = { fullscreenEnabled: false } as Document;
    const video = { webkitEnterFullscreen: () => undefined } as unknown as HTMLVideoElement;

    expect(isFullscreenControlSupported(doc, video)).toBe(true);
  });

  it("returns false when neither fullscreen mechanism exists", () => {
    const doc = { fullscreenEnabled: false } as Document;

    expect(isFullscreenControlSupported(doc, null)).toBe(false);
  });
});

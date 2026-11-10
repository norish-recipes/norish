/**
 * The carousel is what knows which media the reader is actually looking at, so
 * it is what decides whether the page has a video to offer an expand control
 * for (#563). Swiping from the video to a photo has to take the offer back —
 * a control left behind expands something nobody can see.
 */
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { MediaItem } from "@/components/shared/media-carousel";
import MediaCarousel from "@/components/shared/media-carousel";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/components/shared/image-lightbox", () => ({
  default: () => null,
}));

/** The player, reduced to the one thing the carousel asks it to report. */
vi.mock("@/components/shared/video-player", () => ({
  default: ({
    onFullscreenAvailabilityChange,
  }: {
    onFullscreenAvailabilityChange?: (enter: (() => void) | null) => void;
  }) => {
    onFullscreenAvailabilityChange?.(() => {});

    return <div data-testid="video-player" />;
  },
}));

const video: MediaItem = { type: "video", src: "/recipes/r1/demo.mp4", order: 0 };
const image: MediaItem = { type: "image", src: "/recipes/r1/photo.jpg", order: 0 };

describe("what the carousel offers the page to expand", () => {
  it("offers the visible video's fullscreen", async () => {
    const onActiveVideoFullscreenChange = vi.fn();

    await act(async () => {
      render(
        <MediaCarousel
          items={[video]}
          onActiveVideoFullscreenChange={onActiveVideoFullscreenChange}
        />
      );
    });

    expect(onActiveVideoFullscreenChange).toHaveBeenLastCalledWith(expect.any(Function));
  });

  it("offers nothing where the visible media is a still", async () => {
    const onActiveVideoFullscreenChange = vi.fn();

    await act(async () => {
      render(
        <MediaCarousel
          items={[image]}
          onActiveVideoFullscreenChange={onActiveVideoFullscreenChange}
        />
      );
    });

    expect(onActiveVideoFullscreenChange).toHaveBeenLastCalledWith(null);
  });
});

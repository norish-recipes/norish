/**
 * A recipe video could be watched cropped and silent and nothing else (#563).
 * The player draws its own expand control at its bottom edge, which is the
 * exact band the phone recipe hero covers with its fade and its title, so the
 * page has to be able to put that control somewhere the hero cannot swallow —
 * and the fullscreen it opens has to be the whole frame with its sound.
 *
 * jsdom has no fullscreen at all, so these tests stand the API up themselves
 * and then assert what the player does with it.
 */
import type { ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import VideoPlayer from "@/components/shared/video-player";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...rest }: { children?: ReactNode }) => <div {...rest}>{children}</div>,
  },
}));
vi.mock("@/components/skeleton/video-player-skeleton", () => ({
  default: () => <div data-testid="video-skeleton" />,
}));

/** The observer only ever autoplays here; the tests drive playback directly. */
function stubIntersectionObserver() {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
}

/**
 * Element fullscreen, as a browser that has it would offer it: requesting it
 * records the element and fires the document event the player listens for.
 */
function stubElementFullscreen() {
  Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
  Object.defineProperty(document, "fullscreenElement", {
    value: null,
    writable: true,
    configurable: true,
  });

  const setFullscreenElement = (element: Element | null) => {
    (document as unknown as { fullscreenElement: Element | null }).fullscreenElement = element;
    document.dispatchEvent(new Event("fullscreenchange"));
  };

  Element.prototype.requestFullscreen = function requestFullscreen(this: Element) {
    setFullscreenElement(this);

    return Promise.resolve();
  };
  document.exitFullscreen = () => {
    setFullscreenElement(null);

    return Promise.resolve();
  };

  return { setFullscreenElement };
}

function stubPlayback() {
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
}

beforeEach(() => {
  stubIntersectionObserver();
  stubPlayback();
});

describe("a recipe video the page has to draw an expand control for", () => {
  it("hands the page the way into its fullscreen", async () => {
    stubElementFullscreen();

    const onFullscreenAvailabilityChange = vi.fn();

    render(
      <VideoPlayer
        src="/recipes/r1/demo.mp4"
        onFullscreenAvailabilityChange={onFullscreenAvailabilityChange}
      />
    );

    await waitFor(() => {
      expect(onFullscreenAvailabilityChange).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  it("reports none where the browser offers no fullscreen", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { value: false, configurable: true });

    const onFullscreenAvailabilityChange = vi.fn();

    render(
      <VideoPlayer
        src="/recipes/r1/demo.mp4"
        onFullscreenAvailabilityChange={onFullscreenAvailabilityChange}
      />
    );

    await waitFor(() => {
      expect(onFullscreenAvailabilityChange).toHaveBeenCalledWith(null);
    });
    expect(onFullscreenAvailabilityChange).not.toHaveBeenCalledWith(expect.any(Function));
  });

  it("takes it back when it goes away", async () => {
    stubElementFullscreen();

    const onFullscreenAvailabilityChange = vi.fn();
    const { unmount } = render(
      <VideoPlayer
        src="/recipes/r1/demo.mp4"
        onFullscreenAvailabilityChange={onFullscreenAvailabilityChange}
      />
    );

    await waitFor(() => {
      expect(onFullscreenAvailabilityChange).toHaveBeenCalledWith(expect.any(Function));
    });
    onFullscreenAvailabilityChange.mockClear();
    unmount();

    expect(onFullscreenAvailabilityChange).toHaveBeenCalledWith(null);
  });
});

describe("the fullscreen that control opens", () => {
  it("shows the whole frame with its sound, and gives the crop and the silence back on the way out", async () => {
    stubElementFullscreen();

    let enterFullscreen: (() => void) | null = null;

    render(
      <VideoPlayer
        src="/recipes/r1/demo.mp4"
        onFullscreenAvailabilityChange={(enter) => {
          enterFullscreen = enter;
        }}
      />
    );

    const video = document.querySelector("video") as HTMLVideoElement;

    await waitFor(() => expect(enterFullscreen).toBeInstanceOf(Function));
    expect(video).toHaveClass("object-cover");
    expect(video.muted).toBe(true);

    await act(async () => {
      enterFullscreen?.();
    });

    // The hero crops to its own shape on purpose; fullscreen is the one place
    // the whole frame is meant to be visible.
    expect(video).toHaveClass("object-contain");
    expect(video).not.toHaveClass("object-cover");
    expect(video.muted).toBe(false);

    await act(async () => {
      await document.exitFullscreen();
    });

    expect(video).toHaveClass("object-cover");
    expect(video.muted).toBe(true);
  });

  it("plays the same element, so the playback position survives both ways", async () => {
    stubElementFullscreen();

    let enterFullscreen: (() => void) | null = null;

    render(
      <VideoPlayer
        src="/recipes/r1/demo.mp4"
        onFullscreenAvailabilityChange={(enter) => {
          enterFullscreen = enter;
        }}
      />
    );

    const video = document.querySelector("video") as HTMLVideoElement;

    await waitFor(() => expect(enterFullscreen).toBeInstanceOf(Function));

    const fullscreenElements: (Element | null)[] = [];

    document.addEventListener("fullscreenchange", () => {
      fullscreenElements.push(document.fullscreenElement);
    });

    await act(async () => {
      enterFullscreen?.();
    });

    expect(fullscreenElements.at(-1)).toContainElement(video);
  });

  it("leaves the page's other players alone", async () => {
    const { setFullscreenElement } = stubElementFullscreen();

    render(<VideoPlayer src="/recipes/r1/demo.mp4" />);

    const video = document.querySelector("video") as HTMLVideoElement;

    // A recipe page renders its phone and its desktop layout both, one of them
    // hidden, and `fullscreenchange` is a document event every player hears.
    // Read as "someone is fullscreen", the hidden one would unmute and play
    // along with the video actually being watched.
    await act(async () => {
      setFullscreenElement(document.body);
    });

    expect(video).toHaveClass("object-cover");
    expect(video.muted).toBe(true);
  });
});

describe("the sound the reader chose", () => {
  it("survives the video scrolling out of view and back", async () => {
    stubElementFullscreen();

    let intersect: ((entries: { isIntersecting: boolean }[]) => void) | null = null;

    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
          intersect = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );

    render(<VideoPlayer src="/recipes/r1/demo.mp4" />);

    const video = document.querySelector("video") as HTMLVideoElement;
    const user = (await import("@testing-library/user-event")).default;

    await user.click(screen.getByRole("button", { name: "unmute" }));
    expect(video.muted).toBe(false);

    await act(async () => {
      intersect?.([{ isIntersecting: false }]);
      intersect?.([{ isIntersecting: true }]);
    });

    expect(video.muted).toBe(false);
  });
});

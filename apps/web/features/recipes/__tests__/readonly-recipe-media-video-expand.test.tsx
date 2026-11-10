/**
 * Where the expand control for a recipe video lives (#563).
 *
 * The player draws its own at its bottom edge, and the phone recipe hero
 * covers exactly that band — first with the fade the photo dissolves into,
 * then with the title pulled up over it. The floating chrome row is the one
 * part of the hero nothing covers, so the control goes there, beside the way
 * back out of the page and wearing the row's own look: a circle a little
 * different from the ones beside it reads as a mistake rather than a control.
 *
 * Only the phone heroes ask for it. A desktop page shows the player's own bar
 * on hover and has nothing to add.
 */
import type { ReactNode } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { ReadonlyRecipeMedia } from "@/components/recipes/readonly-recipe-sections";
import { RECIPE_HERO_CHROME_BUTTON_CLASS } from "@/components/recipes/recipe-layout-constants";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/components/recipes/author-chip", () => ({
  default: () => <div data-testid="author-chip" />,
}));
vi.mock("@/components/recipes/origin-flag", () => ({
  default: () => <span />,
}));
vi.mock("@/components/shared/smart-markdown-renderer", () => ({
  default: ({ text }: { text: string }) => <div>{text}</div>,
}));

/**
 * The carousel, reduced to the one thing this component asks of it: what the
 * visible item's fullscreen is, if the visible item is an expandable video.
 */
let reportFullscreen: ((enter: (() => void) | null) => void) | null = null;

vi.mock("@/components/shared/media-carousel", () => ({
  default: ({
    onActiveVideoFullscreenChange,
  }: {
    onActiveVideoFullscreenChange?: (enter: (() => void) | null) => void;
  }) => {
    reportFullscreen = onActiveVideoFullscreenChange ?? null;

    return <div data-testid="media-carousel" />;
  },
  buildMediaItems: () => [],
}));

function renderHero(topLeftContent?: ReactNode) {
  return render(
    <ReadonlyRecipeMedia
      chromeClassName="mt-10"
      expandControlSlot="topLeft"
      recipe={{ image: "/recipes/r1/photo.jpg" }}
      topLeftContent={topLeftContent}
    />
  );
}

/** What a desktop page renders: the same media, no expand control asked for. */
function renderDesktopHero() {
  return render(<ReadonlyRecipeMedia recipe={{ image: "/recipes/r1/photo.jpg" }} />);
}

const expandControl = () => screen.queryByRole("button", { name: "fullscreen" });

describe("the expand control on a recipe photo", () => {
  it("is not drawn while the visible media is a still", () => {
    renderHero();

    expect(expandControl()).not.toBeInTheDocument();
  });

  it("appears once the visible media is a video the browser can expand", async () => {
    renderHero();

    await act(async () => {
      reportFullscreen?.(vi.fn());
    });

    expect(expandControl()).toBeInTheDocument();
  });

  it("goes away again when the carousel moves on to a still", async () => {
    renderHero();

    await act(async () => {
      reportFullscreen?.(vi.fn());
    });
    expect(expandControl()).toBeInTheDocument();

    await act(async () => {
      reportFullscreen?.(null);
    });

    expect(expandControl()).not.toBeInTheDocument();
  });

  it("sits beside the back button, dressed as the rest of that row", async () => {
    renderHero(<button type="button">back</button>);

    await act(async () => {
      reportFullscreen?.(vi.fn());
    });

    const control = expandControl();

    expect(control).toHaveClass(...RECIPE_HERO_CHROME_BUTTON_CLASS.split(" "));

    // Same row as the chrome the page put there, after it, and carrying the
    // offset that clears the status bar with it.
    const row = control?.parentElement;

    expect(row).toHaveTextContent("back");
    expect(row).toHaveClass("mt-10");
    expect(row?.firstElementChild).toHaveTextContent("back");
    expect(row?.lastElementChild).toBe(control);
  });

  it("joins the other row when the page names that one instead", async () => {
    render(
      <ReadonlyRecipeMedia
        expandControlSlot="topRight"
        recipe={{ image: "/recipes/r1/photo.jpg" }}
        topRightContent={<button type="button">favourite</button>}
      />
    );

    await act(async () => {
      reportFullscreen?.(vi.fn());
    });

    const row = expandControl()?.parentElement;

    expect(row).toHaveTextContent("favourite");
    expect(row).toHaveClass("right-4");
  });

  it("is not drawn at all on a page that names no slot", async () => {
    renderDesktopHero();

    // A desktop hero shows the player's own controls on hover, so it does not
    // even subscribe to the carousel's offer.
    expect(reportFullscreen).toBeNull();
    expect(expandControl()).not.toBeInTheDocument();
  });

  it("opens the visible video's fullscreen", async () => {
    renderHero();

    const enterFullscreen = vi.fn();

    await act(async () => {
      reportFullscreen?.(enterFullscreen);
    });
    await userEvent.click(expandControl() as HTMLElement);

    expect(enterFullscreen).toHaveBeenCalledTimes(1);
  });
});

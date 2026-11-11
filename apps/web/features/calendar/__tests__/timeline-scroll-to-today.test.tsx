import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { TimelineScrollToToday } from "@/features/calendar/components/timeline/timeline-scroll-to-today";

import {
  cssFloatingDockBottomWithNav,
  cssFloatingDockEndCap,
  cssFloatingDockStackedBottomWithNav,
  cssFloatingDockStackedBottomWithShrunkenNav,
  MOBILE_NAV_SHRUNKEN_SCALE,
} from "@norish/web/config/css-tokens";

const mocks = vi.hoisted(() => ({
  isMobile: true,
  isNavVisible: true,
  dockedTimers: [] as unknown[],
}));

vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => mocks.isMobile,
}));
vi.mock("@/hooks/auto-hide", () => ({
  useAutoHide: () => ({ isVisible: mocks.isNavVisible }),
}));
vi.mock("@/hooks/use-docked-timers", () => ({
  useDockedTimers: () => mocks.dockedTimers,
}));

vi.mock("@heroui/react", () => ({
  Button: ({
    children,
    className,
    onPress,
    ...rest
  }: {
    children: React.ReactNode;
    className?: string;
    onPress?: () => void;
    "aria-label"?: string;
  }) => (
    <button aria-label={rest["aria-label"]} className={className} type="button" onClick={onPress}>
      {children}
    </button>
  ),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

// The wrapper is rendered as a plain element so the offsets it animates
// between are readable without asserting on any class name.
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      animate,
      className,
      style,
    }: {
      children?: React.ReactNode;
      animate?: Record<string, unknown>;
      className?: string;
      style?: Record<string, unknown>;
    }) => (
      <div
        className={className}
        data-animate-bottom={String(animate?.bottom ?? "")}
        data-animate-opacity={String(animate?.opacity ?? "")}
        data-animate-scale={String(animate?.scale ?? "")}
        data-style-bottom={String(style?.bottom ?? "")}
      >
        {children}
      </div>
    ),
  },
}));

beforeEach(() => {
  mocks.isMobile = true;
  mocks.isNavVisible = true;
  mocks.dockedTimers = [];
});

function renderButton(direction: "up" | "down" = "up") {
  render(<TimelineScrollToToday direction={direction} isVisible onClick={() => {}} />);
}

function button(): HTMLElement {
  return screen.getByLabelText("calendar.mobile.scrollToToday");
}

function row(): HTMLElement {
  return button().closest("[data-style-bottom]")!;
}

// The way back to today stacks on the nav pill's end, on the user-menu disc's centre line,
// closer in than the pill row the timer dock stands in.
describe("Back-to-today button", () => {
  it("stands on the nav's end cap rather than up in the pill row", () => {
    renderButton();

    expect(row().dataset.styleBottom).toBe(cssFloatingDockStackedBottomWithNav);
    expect(row().dataset.styleBottom).not.toBe(cssFloatingDockBottomWithNav);
    expect(row().className).toContain("justify-end");
  });

  it("is the same disc the user-menu circle is", () => {
    renderButton();

    for (const token of cssFloatingDockEndCap.split(" ")) {
      expect(button().className).toContain(token);
    }
  });

  it("shrinks with the nav instead of holding still while the bar moves", () => {
    mocks.isNavVisible = false;

    renderButton();

    expect(row().dataset.animateBottom).toBe(cssFloatingDockStackedBottomWithShrunkenNav);
    expect(row().dataset.animateScale).toBe(String(MOBILE_NAV_SHRUNKEN_SCALE));
    // It shrinks in place; it never leaves, so it is always one tap away.
    expect(row().dataset.animateOpacity).toBe("1");
  });

  it("gives up the right end once a timer is docked", () => {
    mocks.dockedTimers = [{ id: "timer-1" }];

    renderButton();

    // The dock owns that corner, so a button left there would sit under it.
    expect(row().className).toContain("justify-start");
    expect(row().className).not.toContain("justify-end");
  });
});

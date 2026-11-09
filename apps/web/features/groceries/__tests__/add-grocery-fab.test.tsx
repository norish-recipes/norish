import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import AddGroceryButton from "@/features/groceries/components/list/add-grocery-button";

import {
  cssFloatingDockBottomWithNav,
  cssFloatingDockBottomWithShrunkenNav,
  cssFloatingDockPill,
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
  }: {
    children: React.ReactNode;
    className?: string;
    onPress?: () => void;
  }) => (
    <button className={className} type="button" onClick={onPress}>
      {children}
    </button>
  ),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

// The wrapper is rendered as a plain element so the offsets and the row it
// animates between are readable without asserting on any class name.
vi.mock("motion/react", () => ({
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

function row(): HTMLElement {
  return screen.getByText("groceries.page.addItems").closest("[data-style-bottom]")!;
}

function pill(): HTMLElement {
  return screen.getByText("groceries.page.addItems").closest("button")!;
}

/**
 * The add pill is the third thing floating above the nav, and it reads the
 * same geometry the cook pill and the timer dock do — so it keeps its station
 * over a shrinking nav rather than dropping behind it, and steps aside when
 * the dock is holding the other end of the row.
 */
describe("Floating add-items pill", () => {
  it("sits above the nav while the nav is showing", () => {
    render(<AddGroceryButton />);

    expect(row().dataset.styleBottom).toBe(cssFloatingDockBottomWithNav);
    expect(row().dataset.animateBottom).toBe(cssFloatingDockBottomWithNav);
  });

  it("shrinks with the nav instead of hiding behind it", () => {
    mocks.isNavVisible = false;

    render(<AddGroceryButton />);

    expect(row().dataset.animateBottom).toBe(cssFloatingDockBottomWithShrunkenNav);
    expect(row().dataset.animateScale).toBe(String(MOBILE_NAV_SHRUNKEN_SCALE));
    // It shrinks in place; it never leaves, so it is always one tap away.
    expect(row().dataset.animateOpacity).toBe("1");
  });

  it("is centred over the nav while it has the row to itself", () => {
    render(<AddGroceryButton />);

    expect(row().className).toContain("justify-center");
  });

  it("moves to the left end once a timer is docked", () => {
    mocks.dockedTimers = [{ id: "timer-1" }];

    render(<AddGroceryButton />);

    // The dock owns the right end, so a centred pill would sit under it.
    expect(row().className).toContain("justify-start");
    expect(row().className).not.toContain("justify-center");
  });

  it("is the same pill the cook button and the timer dock are", () => {
    render(<AddGroceryButton />);

    for (const token of cssFloatingDockPill.split(" ")) {
      expect(pill().className).toContain(token);
    }
  });
});

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import CookingMode from "@/features/recipes/components/page/cooking-mode/cooking-mode";

import { cssFloatingDockBottomWithNav } from "@norish/web/config/css-tokens";

import { onRecipePage } from "./recipe-page";

const mocks = vi.hoisted(() => ({
  isMobile: true,
  isNavVisible: true,
}));

vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => mocks.isMobile,
}));
vi.mock("@/hooks/auto-hide", () => ({
  useAutoHide: () => ({ isVisible: mocks.isNavVisible }),
}));
vi.mock("@norish/shared-react/reader", async () =>
  (await import("@/__tests__/helpers/reader-mock")).mockDevicePreferences(() => ({
    recipePageColor: "theme",
  }))
);
vi.mock("@/components/timer-dock", () => ({
  TimerDock: () => <div data-testid="timer-dock" />,
}));
vi.mock("@/features/recipes/components/page/page-wake-lock", () => ({
  usePageWakeLock: () => ({
    isSupported: false,
    isActive: false,
    enable: vi.fn(),
    disable: vi.fn(),
  }),
}));
vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);
vi.mock("@/features/recipes/components/page/cooking-mode/mobile-cooking-mode-dialog", () => ({
  MobileCookingModeDialog: () => <div data-testid="cooking-dialog" />,
}));
vi.mock("@/features/recipes/components/page/cooking-mode/desktop-cooking-mode-dialog", () => ({
  DesktopCookingModeDialog: () => <div data-testid="cooking-dialog" />,
}));

// The wrapper is rendered as a plain element so the offsets it animates
// between are readable without asserting on any class name.
vi.mock("motion/react", () => ({
  motion: {
    div: ({
      children,
      animate,
      style,
    }: {
      children?: React.ReactNode;
      animate?: Record<string, unknown>;
      style?: Record<string, unknown>;
    }) => (
      <div
        data-animate-bottom={String(animate?.bottom ?? "")}
        data-animate-opacity={String(animate?.opacity ?? "")}
        data-animate-scale={String(animate?.scale ?? "")}
        data-style-bottom={String(style?.bottom ?? "")}
      >
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
  Modal: {
    Backdrop: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
      isOpen ? <div>{children}</div> : null,
    Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

beforeEach(() => {
  mocks.isMobile = true;
  mocks.isNavVisible = true;
});

function renderOnPage(ui: React.ReactElement) {
  const { wrapper } = onRecipePage({
    id: "recipe-1",
    name: "Cacio e Pepe",
    steps: [],
    recipeIngredients: [],
    servings: 2,
    systemUsed: "metric",
  });

  return render(ui, { wrapper });
}

function pill(): HTMLElement {
  return screen.getByText("recipes.detail.cook").closest("[data-style-bottom]")!;
}

/**
 * The cook pill mirrors the timer dock's corner across the nav pill and
 * reads the same offsets, so the two rise and fall with the nav together
 * rather than drifting apart.
 */
describe("Floating cook pill", () => {
  it("sits above the nav while the nav is showing", () => {
    renderOnPage(<CookingMode floating />);

    expect(pill().dataset.styleBottom).toBe(cssFloatingDockBottomWithNav);
    expect(pill().dataset.animateBottom).toBe(cssFloatingDockBottomWithNav);
  });

  it("leaves with the nav rather than riding along shrunken", () => {
    mocks.isNavVisible = false;

    renderOnPage(<CookingMode floating />);

    // A reader scrolling the recipe is reading. The timer dock has something
    // to say while it is scrolled past; a cook button does not, and it is one
    // gesture away when they stop.
    expect(pill().dataset.animateOpacity).toBe("0");
  });

  it("takes no taps once it has left", () => {
    mocks.isNavVisible = false;

    renderOnPage(<CookingMode floating />);

    expect(screen.getByText("recipes.detail.cook").closest("button")!.className).toContain(
      "pointer-events-none"
    );
  });

  it("is there at full size while the nav is showing", () => {
    renderOnPage(<CookingMode floating />);

    expect(pill().dataset.animateScale).toBe("1");
    expect(pill().dataset.animateOpacity).toBe("1");
  });

  it("always reads Cook, because a Cooking Session is never resumed", () => {
    renderOnPage(<CookingMode floating />);

    expect(screen.getByText("recipes.detail.cook")).toBeInTheDocument();
    expect(screen.queryByText(/continue/i)).not.toBeInTheDocument();
  });

  it("stays in the content flow when it is not floating", () => {
    renderOnPage(<CookingMode fullWidth />);

    expect(screen.getByText("recipes.detail.cook").closest("[data-style-bottom]")).toBeNull();
  });
});

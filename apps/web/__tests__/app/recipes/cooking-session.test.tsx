import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import CookingMode from "@/app/(app)/recipes/[id]/components/cookingmode/cooking-mode";

const mocks = vi.hoisted(() => ({
  totalMinutes: 90 as number | null,
  dishColor: null as string | null,
  recipePageColor: "theme" as "theme" | "dish",
}));

vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => true }));
vi.mock("@/hooks/auto-hide", () => ({ useAutoHide: () => ({ isVisible: true }) }));
vi.mock("@/context/recipe-page-color-context", () => ({
  useRecipePageColor: () => [mocks.recipePageColor, () => {}],
}));
vi.mock("@/components/timer-dock", () => ({ TimerDock: () => <div /> }));
vi.mock("@/app/(app)/recipes/[id]/components/wake-lock-context", () => ({
  useWakeLockContext: () => ({
    isSupported: false,
    isActive: false,
    enable: vi.fn(),
    disable: vi.fn(),
  }),
}));
vi.mock("@/app/(app)/recipes/[id]/context", () => ({
  useRecipeContextRequired: () => ({
    adjustedIngredients: [],
    recipe: {
      id: "recipe-1",
      name: "Cacio e Pepe",
      categories: ["Dinner"],
      totalMinutes: mocks.totalMinutes,
      dishColor: mocks.dishColor,
      images: [],
      image: null,
      steps: [
        { step: "Boil the water.", systemUsed: "metric", order: 0 },
        { step: "Serve.", systemUsed: "metric", order: 1 },
      ],
      recipeIngredients: [],
      servings: 2,
      systemUsed: "metric",
    },
  }),
}));
vi.mock("@/app/(app)/recipes/[id]/components/cookingmode/use-is-desktop-cooking-mode", () => ({
  useIsDesktopCookingMode: () => false,
}));

// The dialog reports the session facts the page cannot see for itself, offers
// the close the header would, and wires the swipe handlers onto two regions:
// a long step's own scroll region and the strip beside it.
type DialogProps = {
  activeStep: number;
  activeView: string;
  readyAt: Date | null;
  onClose: () => void;
  onPointerDown: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
};

function dialog({
  activeStep,
  activeView,
  readyAt,
  onClose,
  onPointerDown,
  onPointerUp,
}: DialogProps) {
  return (
    <div
      data-active-step={String(activeStep)}
      data-active-view={activeView}
      data-ready-at={readyAt ? readyAt.toISOString() : ""}
      data-testid="cooking-dialog"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div data-cooking-step-scroll="true" data-testid="step-scroll" />
      <div data-testid="swipe-edge" />
      <button type="button" onClick={onClose}>
        close-cooking
      </button>
    </div>
  );
}

vi.mock("@/app/(app)/recipes/[id]/components/cookingmode/mobile-cooking-mode-dialog", () => ({
  MobileCookingModeDialog: (props: DialogProps) => dialog(props),
}));
vi.mock("@/app/(app)/recipes/[id]/components/cookingmode/desktop-cooking-mode-dialog", () => ({
  DesktopCookingModeDialog: (props: DialogProps) => dialog(props),
}));

vi.mock("motion/react", () => ({
  motion: { div: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@heroui/react", () => ({
  Button: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
  Modal: {
    Backdrop: ({
      children,
      isOpen,
      style,
      "data-dish-tint": dishTint,
    }: {
      children: React.ReactNode;
      isOpen: boolean;
      style?: React.CSSProperties;
      "data-dish-tint"?: boolean;
    }) =>
      isOpen ? (
        <div data-dish-tint={dishTint} data-testid="cooking-backdrop" style={style}>
          {children}
        </div>
      ) : null,
    Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

beforeEach(() => {
  mocks.totalMinutes = 90;
  mocks.dishColor = null;
  mocks.recipePageColor = "theme";
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-08-21T16:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

function openCooking() {
  fireEvent.click(screen.getByText("recipes.detail.cook"));
}

/**
 * A Cooking Session begins when cooking mode opens and ends when it closes:
 * nothing about it is written down, so reopening always begins a new one at
 * the first step with a fresh Ready At.
 */
describe("Cooking Session", () => {
  it("anchors Ready At to when cooking mode opened, not to page load", () => {
    render(<CookingMode floating />);

    // An hour passes on the recipe page before the cook actually starts.
    vi.setSystemTime(new Date("2026-08-21T17:00:00.000Z"));
    openCooking();

    expect(screen.getByTestId("cooking-dialog").dataset.readyAt).toBe("2026-08-21T18:30:00.000Z");
  });

  it("starts a fresh session at the first step when reopened", () => {
    render(<CookingMode floating />);

    openCooking();

    const dialogEl = screen.getByTestId("cooking-dialog");

    expect(dialogEl.dataset.activeStep).toBe("0");

    fireEvent.keyDown(window, { key: "ArrowDown" });

    expect(screen.getByTestId("cooking-dialog").dataset.activeStep).toBe("1");

    // Closing ends the session; nothing about it survives.
    fireEvent.click(screen.getByText("close-cooking"));

    expect(screen.queryByTestId("cooking-dialog")).not.toBeInTheDocument();

    vi.setSystemTime(new Date("2026-08-21T18:00:00.000Z"));
    openCooking();

    expect(screen.getByTestId("cooking-dialog").dataset.activeStep).toBe("0");
    expect(screen.getByTestId("cooking-dialog").dataset.readyAt).toBe("2026-08-21T19:30:00.000Z");
  });

  it("has no Ready At for a recipe with no total time", () => {
    mocks.totalMinutes = null;

    render(<CookingMode floating />);

    openCooking();

    expect(screen.getByTestId("cooking-dialog").dataset.readyAt).toBe("");
  });
});

function swipe(target: HTMLElement, deltaX: number, deltaY: number) {
  fireEvent.pointerDown(target, { clientX: 100, clientY: 300, pointerType: "touch" });
  fireEvent.pointerUp(target, {
    clientX: 100 + deltaX,
    clientY: 300 + deltaY,
    pointerType: "touch",
  });
}

/**
 * A long step scrolls inside its own page, so a vertical drag in there is a
 * scroll rather than a page turn. That is the only gesture it costs: reaching
 * the ingredients sideways still works from anywhere.
 */
describe("Cooking mode swipes on a long step", () => {
  it("still reaches the ingredients sideways from inside the scroll region", () => {
    render(<CookingMode floating />);

    openCooking();
    swipe(screen.getByTestId("step-scroll"), -120, 0);

    expect(screen.getByTestId("cooking-dialog").dataset.activeView).toBe("ingredients");
  });
});

/**
 * The modal portals out of the recipe page's dish-tint scope, so cooking mode
 * re-establishes it on its own backdrop (ADR-0023): the bottom bar's ground
 * and every tinted token inside follow the dish exactly as the page does.
 */
describe("Cooking mode dish tint", () => {
  it("re-establishes the dish tint scope on its backdrop", () => {
    mocks.dishColor = "#cc7733";
    mocks.recipePageColor = "dish";

    render(<CookingMode floating />);
    openCooking();

    const backdrop = screen.getByTestId("cooking-backdrop");

    expect(backdrop).toHaveAttribute("data-dish-tint");
    expect(backdrop.style.getPropertyValue("--dish-h")).not.toBe("");
    expect(backdrop.style.getPropertyValue("--dish-c")).not.toBe("");
  });

  it("stays untinted for a reader whose recipe pages follow the theme", () => {
    mocks.dishColor = "#cc7733";
    mocks.recipePageColor = "theme";

    render(<CookingMode floating />);
    openCooking();

    const backdrop = screen.getByTestId("cooking-backdrop");

    expect(backdrop).not.toHaveAttribute("data-dish-tint");
    expect(backdrop.style.getPropertyValue("--dish-h")).toBe("");
  });

  it("stays untinted for a recipe with no Dish Colour", () => {
    mocks.dishColor = null;
    mocks.recipePageColor = "dish";

    render(<CookingMode floating />);
    openCooking();

    expect(screen.getByTestId("cooking-backdrop")).not.toHaveAttribute("data-dish-tint");
  });
});

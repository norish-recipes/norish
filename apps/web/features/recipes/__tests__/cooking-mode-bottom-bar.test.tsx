import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { CookingModeBottomBar } from "@/app/(app)/recipes/[id]/components/cookingmode/cooking-mode-bottom-bar";

const mocks = vi.hoisted(() => ({ timerCount: 0, timersEnabled: true }));

vi.mock("@norish/shared-react/config", () => ({
  useTimersEnabledQuery: () => ({ timersEnabled: mocks.timersEnabled }),
}));

vi.mock("@/stores/timers", () => ({
  useTimerStore: (selector: (state: { timers: unknown[] }) => unknown) =>
    selector({ timers: Array.from({ length: mocks.timerCount }, () => ({})) }),
}));

vi.mock("@/app/(app)/recipes/[id]/components/wake-lock-toggle", () => ({
  default: ({ autoEnable }: { autoEnable?: boolean }) => (
    <div data-auto-enable={String(autoEnable)} data-testid="wake-lock-toggle" />
  ),
}));

vi.mock("@heroui/react", () => ({
  Button: ({
    children,
    isDisabled,
    onPress,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    isDisabled?: boolean;
    onPress?: () => void;
    "aria-label"?: string;
  }) => (
    <button aria-label={ariaLabel} disabled={isDisabled} type="button" onClick={onPress}>
      {children}
    </button>
  ),
  Meter: Object.assign(
    ({ children, value }: { children: React.ReactNode; value: number }) => (
      <div data-testid="meter" data-value={String(value)}>
        {children}
      </div>
    ),
    {
      Track: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Fill: () => <div />,
    }
  ),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en-GB",
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) =>
    values ? `${namespace}.${key}:${JSON.stringify(values)}` : `${namespace}.${key}`,
}));

const STEPS = [0, 1, 2].map((index) => ({
  originalIndex: index,
  stepNumber: index + 1,
  text: `Step ${index + 1}`,
  images: [],
  stepIngredients: [],
}));

function renderBar(overrides: Partial<Parameters<typeof CookingModeBottomBar>[0]> = {}) {
  const props = {
    activeStep: 1,
    activeView: "steps" as const,
    areTimersOpen: false,
    readyAt: new Date("2026-08-21T17:45:00Z"),
    steps: STEPS,
    onStepChange: vi.fn(),
    onViewChange: vi.fn(),
    onTimersOpenChange: vi.fn(),
    ...overrides,
  };

  render(<CookingModeBottomBar {...props} />);

  return props;
}

beforeEach(() => {
  mocks.timerCount = 0;
  mocks.timersEnabled = true;
});

describe("Cooking mode bottom bar", () => {
  it("carries the meter, Ready At and the step counter", () => {
    renderBar();

    expect(screen.getByTestId("meter")).toBeInTheDocument();
    expect(screen.getByText(/recipes\.cookMode\.readyAt/)).toBeInTheDocument();
    expect(screen.getByText(/recipes\.cookMode\.stepCounter/)).toBeInTheDocument();
  });

  it("shows no Ready At for a recipe with no total time", () => {
    renderBar({ readyAt: null });

    expect(screen.queryByText(/recipes\.cookMode\.readyAt/)).not.toBeInTheDocument();
  });

  it("keeps a back chevron, disabled on the first step", () => {
    renderBar({ activeStep: 0 });

    expect(screen.getByLabelText("common.actions.back")).toBeDisabled();
  });

  it("goes back a step", () => {
    const props = renderBar();

    fireEvent.click(screen.getByLabelText("common.actions.back"));

    expect(props.onStepChange).toHaveBeenCalledWith(0);
  });

  it("goes on a step", () => {
    const props = renderBar();

    fireEvent.click(screen.getByLabelText("recipes.cookMode.nextStep"));

    expect(props.onStepChange).toHaveBeenCalledWith(2);
  });

  it("reads Done on the last step", () => {
    renderBar({ activeStep: 2 });

    expect(screen.getByLabelText("common.actions.done")).toBeDisabled();
  });

  it("flips the ingredients button to steps while ingredients are showing", () => {
    const props = renderBar({ activeView: "ingredients" });

    fireEvent.click(screen.getByLabelText("recipes.cookMode.steps"));

    expect(props.onViewChange).toHaveBeenCalledWith("steps");
  });

  it("reaches the ingredients from the steps", () => {
    const props = renderBar();

    fireEvent.click(screen.getByLabelText("recipes.cookMode.ingredients"));

    expect(props.onViewChange).toHaveBeenCalledWith("ingredients");
  });

  it("offers timers only once there are some running", () => {
    renderBar();

    expect(screen.getByLabelText("recipes.cookMode.timers")).toBeDisabled();
  });

  it("drops the timers button entirely for a reader who has timers hidden", () => {
    mocks.timersEnabled = false;
    mocks.timerCount = 2;

    renderBar();

    // Hiding still means hidden: not a control the reader cannot use.
    expect(screen.queryByLabelText("recipes.cookMode.timers")).not.toBeInTheDocument();
  });

  it("opens the timers a cook already started", () => {
    mocks.timerCount = 2;

    const props = renderBar();

    fireEvent.click(screen.getByLabelText("recipes.cookMode.timers"));

    expect(props.onTimersOpenChange).toHaveBeenCalledWith(true);
  });

  it("leaves the wake lock to cooking mode, which already took it", () => {
    renderBar();

    expect(screen.getByTestId("wake-lock-toggle").dataset.autoEnable).toBe("false");
  });
});

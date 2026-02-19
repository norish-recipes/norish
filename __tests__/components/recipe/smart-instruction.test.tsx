import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { SmartInstruction } from "@/components/recipe/smart-instruction";

vi.mock("@/lib/logger", () => ({ createClientLogger: () => () => ({ warn: () => {} }) }));

vi.mock("@/hooks/config", () => ({
  useTimersEnabledQuery: () => ({ timersEnabled: false }),
  useTimerKeywordsQuery: () => ({
    timerKeywords: { enabled: true, hours: [], minutes: [], seconds: [] },
  }),
}));

// Replace the TimerChip with a simple marker to detect it if rendered
vi.mock("@/components/recipe/timer-chip", () => ({
  TimerChip: ({ _children }: any) => <span>TIMER_CHIP</span>,
}));

describe("SmartInstruction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not render timers when timers are disabled", () => {
    render(
      <SmartInstruction recipeId="r1" recipeName="R" stepIndex={0} text={"Bake for 10 minutes"} />
    );

    expect(screen.queryByText("TIMER_CHIP")).toBeNull();
    expect(screen.getByText(/Bake for 10 minutes/)).toBeInTheDocument();
  });
});

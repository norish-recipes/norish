import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";

vi.mock("@/components/recipe/timer-chip", () => ({
  TimerChip: ({ originalText }: { originalText: string }) => <span>timer:{originalText}</span>,
}));

describe("SmartMarkdownRenderer", () => {
  it("renders legacy @ tokens as the literal text they always were", () => {
    // Inline linkification is retired outright: Step Ingredients carry the
    // links now, and stored text renders exactly as written.
    render(<SmartMarkdownRenderer text="Season with @salt." />);

    expect(screen.getByText(/Season with @salt\./)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders legacy braced tokens literally too", () => {
    render(<SmartMarkdownRenderer text="Stir @ground black pepper{2 g} in." />);

    expect(screen.getByText(/Stir @ground black pepper\{2 g\} in\./)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps public recipe references as text", () => {
    render(<SmartMarkdownRenderer linkMode="public" text="See [Sauce](id:recipe-123)." />);

    expect(screen.getByText(/Sauce/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sauce" })).toBeNull();
  });

  it("renders private recipe references as recipe links", () => {
    render(<SmartMarkdownRenderer text="See [Sauce](id:recipe-123)." />);

    expect(screen.getByRole("link", { name: "Sauce" })).toHaveAttribute(
      "href",
      "/recipes/recipe-123"
    );
  });

  it("still renders timers beside literal legacy tokens", () => {
    render(
      <SmartMarkdownRenderer
        text="Stir @salt for 10 minutes."
        timerConfig={{
          enabled: true,
          recipeId: "recipe-1",
          recipeName: "Soup",
          stepIndex: 0,
        }}
      />
    );

    expect(screen.getByText("timer:10 minutes")).toBeInTheDocument();
    expect(screen.getByText(/@salt/)).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import CookingTimeCard from "@/components/recipes/cooking-time-card";

vi.mock("@heroui/react", () => ({
  Card: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

describe("CookingTimeCard", () => {
  it("leads with the stored total and names the shortfall as Other Time", () => {
    render(<CookingTimeCard recipe={{ prepMinutes: 20, cookMinutes: 40, totalMinutes: 180 }} />);

    expect(screen.getByText("3:00h")).toBeInTheDocument();
    expect(screen.getByText("recipes.cookingTime.other")).toBeInTheDocument();
    expect(screen.getByText("2:00h")).toBeInTheDocument();
  });

  it("draws no legend for a total with no split", () => {
    render(<CookingTimeCard recipe={{ prepMinutes: null, cookMinutes: null, totalMinutes: 45 }} />);

    expect(screen.getByText("45m")).toBeInTheDocument();
    expect(screen.queryByText("recipes.cookingTime.prep")).not.toBeInTheDocument();
    expect(screen.queryByText("recipes.cookingTime.other")).not.toBeInTheDocument();
  });

  it("is absent when the recipe stores no times", () => {
    const { container } = render(
      <CookingTimeCard recipe={{ prepMinutes: null, cookMinutes: null, totalMinutes: null }} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("projects no finish time", () => {
    render(<CookingTimeCard recipe={{ prepMinutes: 20, cookMinutes: 40, totalMinutes: 180 }} />);

    // Ready At belongs to a Cooking Session and is shown in cooking mode alone.
    expect(screen.queryByText(/readyAt/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d{1,2}:\d{2}\s?(AM|PM)?$/)).not.toBeInTheDocument();
  });
});

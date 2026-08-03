import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { ReadonlyStepsList } from "@/components/recipes/readonly-steps-list";

vi.mock("@/components/recipe/smart-instruction", () => ({
  SmartInstruction: ({ text }: { text: string }) => <span>{text}</span>,
}));
vi.mock("@/components/shared/smart-markdown-renderer", () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));
vi.mock("@/components/shared/image-lightbox", () => ({
  default: () => null,
}));
vi.mock("@/hooks/use-amount-display-preference", () => ({
  useAmountDisplayPreference: () => ({ mode: "decimal" }),
}));
vi.mock("@/hooks/use-unit-formatter", () => ({
  useUnitFormatter: () => ({
    formatUnitOnly: (unit: string | null | undefined) => unit ?? "",
  }),
}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
}));

const LINES = [
  { ingredientName: "water", amount: 50, unit: "ml", systemUsed: "metric", order: 0 },
  { ingredientName: "salt", amount: null, unit: null, systemUsed: "metric", order: 1 },
  { ingredientName: "flour", amount: 300, unit: "g", systemUsed: "metric", order: 2 },
];

function renderSteps(
  steps: React.ComponentProps<typeof ReadonlyStepsList>["steps"],
  ingredients = LINES
) {
  return render(<ReadonlyStepsList ingredients={ingredients} steps={steps} systemUsed="metric" />);
}

describe("Step Ingredients under steps", () => {
  it("renders the derived amount beneath the step", () => {
    renderSteps([
      {
        step: "Add half the water.",
        systemUsed: "metric",
        order: 0,
        stepIngredients: [{ ingredientOrder: 0, share: 0.5, order: 0 }],
      },
    ]);

    // 0.5 × 50 ml, derived at display time — never stored.
    expect(screen.getByText("25 ml water")).toBeInTheDocument();
  });

  it("shows the name only for a line with no amount", () => {
    renderSteps([
      {
        step: "Season with the salt.",
        systemUsed: "metric",
        order: 0,
        stepIngredients: [{ ingredientOrder: 1, share: 1, order: 0 }],
      },
    ]);

    expect(screen.getByText("salt")).toBeInTheDocument();
  });

  it("lists every line an aggregate step references, in reference order", () => {
    renderSteps([
      {
        step: "Combine the dry ingredients with the water.",
        systemUsed: "metric",
        order: 0,
        stepIngredients: [
          { ingredientOrder: 2, share: 1, order: 0 },
          { ingredientOrder: 0, share: 0.5, order: 1 },
        ],
      },
    ]);

    const items = screen.getAllByRole("listitem").filter((item) => item.closest("ul") !== null);
    const labels = items.map((item) => item.textContent);

    expect(labels).toContain("300 g flour");
    expect(labels).toContain("25 ml water");
    expect(labels.indexOf("300 g flour")).toBeLessThan(labels.indexOf("25 ml water"));
  });

  it("renders nothing extra for a step without references", () => {
    renderSteps([{ step: "Serve.", systemUsed: "metric", order: 0 }]);

    expect(screen.getByText("Serve.")).toBeInTheDocument();
    expect(screen.queryByText(/water|flour|salt/)).not.toBeInTheDocument();
  });

  it("follows an edit to the line's amount without the reference changing", () => {
    const steps = [
      {
        step: "Add half the water.",
        systemUsed: "metric",
        order: 0,
        stepIngredients: [{ ingredientOrder: 0, share: 0.5, order: 0 }],
      },
    ];
    const { rerender } = renderSteps(steps);

    expect(screen.getByText("25 ml water")).toBeInTheDocument();

    rerender(
      <ReadonlyStepsList
        ingredients={LINES.map((line) => (line.order === 0 ? { ...line, amount: 80 } : line))}
        steps={steps}
        systemUsed="metric"
      />
    );

    expect(screen.getByText("40 ml water")).toBeInTheDocument();
  });
});

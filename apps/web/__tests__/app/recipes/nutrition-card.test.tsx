import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import NutritionCard from "@/app/(app)/recipes/[id]/components/nutrition-card";

const mocks = vi.hoisted(() => ({
  hasData: false,
  state: "idle" as "idle" | "queued" | "processing" | "succeeded" | "failed",
  hidden: [] as string[],
}));

vi.mock("@/context/user-context", () => ({
  useUserContext: () => ({ user: { id: "owner-1", preferences: { hidden: mocks.hidden } } }),
}));

vi.mock("@/app/(app)/recipes/[id]/context", () => ({
  useRecipeContext: () => ({
    recipe: {
      id: "recipe-1",
      userId: "owner-1",
      calories: null,
      fat: null,
      carbs: null,
      protein: null,
    },
    enrichment: {
      states: { "nutrition-estimation": mocks.state },
      isBusy: () => mocks.state === "queued" || mocks.state === "processing",
      request: vi.fn(),
    },
  }),
}));

vi.mock("@/components/recipes/readonly-nutrition", () => ({
  MACROS: [],
  getNutritionData: () => ({ hasData: mocks.hasData, values: {} }),
}));

vi.mock("@/components/recipes/nutrition-portion-control", () => ({
  default: () => null,
}));

vi.mock("@heroui/react", () => ({
  Card: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
  Separator: () => <hr />,
  Skeleton: () => <span data-testid="skeleton" />,
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const states: Record<string, string> = {
      "states.queued": "Queued",
      "states.processing": "In progress",
      "states.succeeded": "Completed",
      "states.failed": "Last run failed",
    };

    return namespace === "recipes.enrichment" ? (states[key] ?? key) : key;
  },
}));

/**
 * The card follows the Recipe Provenance rules: absent when there is nothing
 * stored and nothing running, working without naming lifecycle states, and
 * never reporting enrichment state — that lives in the actions menu.
 */
describe("NutritionCard", () => {
  beforeEach(() => {
    mocks.hasData = false;
    mocks.state = "idle";
    mocks.hidden = [];
  });

  it("is absent when nothing is stored and nothing is running", () => {
    const { container } = render(<NutritionCard />);

    expect(container).toBeEmptyDOMElement();
  });

  it("stays absent after a quiet automatic failure left nothing stored", () => {
    mocks.state = "failed";

    const { container } = render(<NutritionCard />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Last run failed")).not.toBeInTheDocument();
  });

  it.each([["queued"], ["processing"]] as const)(
    "renders a %s run as working, without naming the state",
    (state) => {
      mocks.state = state;

      render(<NutritionCard />);

      expect(screen.getByRole("heading", { name: "title" })).toBeInTheDocument();
      expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
      expect(screen.queryByText("Queued")).not.toBeInTheDocument();
      expect(screen.queryByText("In progress")).not.toBeInTheDocument();
    }
  );

  it("shows stored values without any lifecycle state beside them", () => {
    mocks.hasData = true;
    mocks.state = "failed";

    render(<NutritionCard />);

    expect(screen.getByRole("heading", { name: "title" })).toBeInTheDocument();
    expect(screen.queryByText("Last run failed")).not.toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
  });

  it("is absent when the reader has hidden Nutrition Information", () => {
    mocks.hasData = true;
    mocks.hidden = ["nutrition"];

    const { container } = render(<NutritionCard />);

    expect(container).toBeEmptyDOMElement();
  });

  it("stays absent for a hiding reader even while a run is in flight", () => {
    mocks.hidden = ["nutrition"];
    mocks.state = "processing";

    const { container } = render(<NutritionCard />);

    expect(container).toBeEmptyDOMElement();
  });
});

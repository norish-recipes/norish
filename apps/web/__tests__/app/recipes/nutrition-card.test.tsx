import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import NutritionCard from "@/app/(app)/recipes/[id]/components/nutrition-card";

import type { WorkedOutNutrition } from "@norish/shared/lib/recipe-nutrition";

const mocks = vi.hoisted(() => ({
  hasData: false,
  state: "idle" as "idle" | "queued" | "processing" | "succeeded" | "failed",
  hidden: [] as string[],
  workedOut: null as WorkedOutNutrition | null,
  shown: null as unknown,
}));

vi.mock("@/hooks/recipes/use-worked-out-nutrition", () => ({
  useWorkedOutNutrition: () => mocks.workedOut,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/context/user-context", () => ({
  useUserContext: () => ({ user: { id: "owner-1" } }),
}));

vi.mock("@/context/hidden-items-context", () => ({
  useHiddenItems: () => mocks.hidden,
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
  getNutritionData: () => ({ hasData: mocks.hasData, values: {} }),
  NutritionBody: ({ recipe }: { recipe: unknown }) => {
    mocks.shown = recipe;

    return <div data-testid="nutrition-body" />;
  },
}));

vi.mock("@/components/recipes/nutrition-portion-control", () => ({
  default: () => null,
}));

vi.mock("@heroui/react", () => ({
  Card: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
  Chip: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Separator: () => <hr />,
  Skeleton: () => <span data-testid="skeleton" />,
}));

vi.mock("next-intl", () => ({
  useFormatter: () => ({ list: (items: string[]) => items.join(" + ") }),
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string>) => {
    if (values?.sources) return `${key}: ${values.sources}`;
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
    mocks.workedOut = null;
    mocks.shown = null;
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

  describe("a total worked out from the lines", () => {
    const workedOut: WorkedOutNutrition = {
      perServing: { calories: 420, fat: 12, carbs: 50, protein: 20 },
      uncounted: [
        { lineId: "line-1", name: "olive oil for frying", ingredientId: "olive-oil" },
        { lineId: "line-2", name: "a mystery", ingredientId: null },
      ],
      estimated: true,
      credits: ["ciqual", "off"],
      household: true,
    };

    it("shows the worked-out numbers where the recipe stores none", () => {
      mocks.workedOut = workedOut;

      render(<NutritionCard />);

      expect(screen.getByTestId("nutrition-body")).toBeInTheDocument();
      expect(mocks.shown).toEqual({ calories: 420, fat: 12, carbs: 50, protein: 20 });
    });

    it("says it is estimated, names what it did not count, and credits what it used", () => {
      mocks.workedOut = workedOut;

      render(<NutritionCard />);

      expect(screen.getByTestId("nutrition-estimated")).toHaveTextContent("estimated");
      expect(screen.getByText("olive oil for frying")).toHaveAttribute(
        "href",
        "/settings?tab=ingredients&ingredient=olive-oil"
      );
      expect(screen.getByText("a mystery").tagName).toBe("SPAN");
      expect(screen.getByTestId("nutrition-credit")).toHaveTextContent(
        "CIQUAL 2025 + Open Food Facts + householdNumbers"
      );
    });

    it("is not called estimated where nothing was borrowed", () => {
      mocks.workedOut = { ...workedOut, estimated: false, uncounted: [] };

      render(<NutritionCard />);

      expect(screen.queryByTestId("nutrition-estimated")).not.toBeInTheDocument();
      expect(screen.queryByTestId("nutrition-not-counted")).not.toBeInTheDocument();
    });

    it("leaves what the recipe supplies alone", () => {
      mocks.hasData = true;
      mocks.workedOut = workedOut;

      render(<NutritionCard />);

      expect(mocks.shown).toMatchObject({ id: "recipe-1" });
      expect(screen.queryByTestId("nutrition-credit")).not.toBeInTheDocument();
    });

    it("is absent where no line counted", () => {
      mocks.workedOut = { ...workedOut, perServing: null };

      const { container } = render(<NutritionCard />);

      expect(container).toBeEmptyDOMElement();
    });
  });
});

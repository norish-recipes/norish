import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import NutritionCard from "@/app/(app)/recipes/[id]/components/nutrition-card";

import type { LeftOutLine, WorkedOutNutrition } from "@norish/shared/lib/recipe-nutrition";

const mocks = vi.hoisted(() => ({
  hasData: false,
  state: "idle" as "idle" | "queued" | "processing" | "succeeded" | "failed",
  hidden: [] as string[],
  workedOut: null as WorkedOutNutrition | null,
  shown: null as unknown,
  marked: undefined as boolean | undefined,
  panel: null as { id: string | null; open: boolean } | null,
}));

vi.mock("@/hooks/recipes/use-worked-out-nutrition", () => ({
  useWorkedOutNutrition: () => mocks.workedOut,
}));

vi.mock("@/components/ingredients/ingredient-panel", () => ({
  IngredientPanel: ({ id, open }: { id: string | null; open: boolean }) => {
    mocks.panel = { id, open };

    return open ? <div data-testid="ingredient-panel">{id}</div> : null;
  },
}));

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    ingredients: {
      nutritionFor: { pathKey: () => ["ingredients", "nutritionFor"] },
      list: { pathKey: () => ["ingredients", "list"] },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/context/user-context", () => ({
  useUserContext: () => ({ user: { id: "owner-1" } }),
}));

vi.mock("@/context/device-preferences-context", async () =>
  (await import("../../helpers/device-preferences-mock")).mockDevicePreferences(() => ({
    hiddenItems: mocks.hidden,
  }))
);

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
  NutritionBody: ({ recipe, marked }: { recipe: unknown; marked?: boolean }) => {
    mocks.shown = recipe;
    mocks.marked = marked;

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
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    if (values?.sources) return `${key}: ${values.sources}`;
    if (values?.count !== undefined) return `${key}: ${values.count}`;
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
    mocks.panel = null;
    mocks.state = "idle";
    mocks.hidden = [];
    mocks.workedOut = null;
    mocks.shown = null;
    mocks.marked = undefined;
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
    const left = (
      lineId: string,
      name: string,
      ingredientId: string | null,
      reason: LeftOutLine["reason"],
      estimatedByAI = false
    ): LeftOutLine => ({ lineId, name, ingredientId, key: lineId, reason, estimatedByAI });
    const workedOut: WorkedOutNutrition = {
      perServing: { calories: 420, fat: 12, carbs: 50, protein: 20 },
      leftOut: [
        left("line-1", "olive oil for frying", "olive-oil", "no-amount"),
        left("line-2", "1 tl komijn", "cumin", "no-spoon-weight"),
        left("line-3", "a mystery", null, "no-numbers"),
        left("line-4", "salt to taste", "salt", "seasoning"),
      ],
      counted: [],
      estimated: true,
      credits: ["ciqual", "off"],
      household: true,
    };
    const openList = () => fireEvent.click(screen.getByTestId("nutrition-left-out-toggle"));
    const listed = () =>
      screen.getAllByTestId("nutrition-left-out-line").map((line) => line.textContent);

    it("shows the worked-out numbers where the recipe stores none", () => {
      mocks.workedOut = workedOut;

      render(<NutritionCard />);

      expect(screen.getByTestId("nutrition-body")).toBeInTheDocument();
      expect(mocks.shown).toEqual({ calories: 420, fat: 12, carbs: 50, protein: 20 });
    });

    it("says it is estimated, and credits what it used", () => {
      mocks.workedOut = workedOut;

      render(<NutritionCard />);

      expect(screen.getByTestId("nutrition-estimated")).toHaveTextContent("estimated");
      expect(screen.getByTestId("nutrition-credit")).toHaveTextContent(
        "CIQUAL 2025 + Open Food Facts + householdNumbers"
      );
    });

    it("marks the calories and says how many lines it left out, the list closed until asked", () => {
      mocks.workedOut = workedOut;

      render(<NutritionCard />);

      expect(mocks.marked).toBe(true);
      expect(screen.getByTestId("nutrition-left-out-toggle")).toHaveTextContent("leftOut: 4");
      expect(screen.getByTestId("nutrition-left-out-toggle")).toHaveAttribute(
        "aria-expanded",
        "false"
      );
      expect(screen.queryByTestId("nutrition-left-out")).not.toBeInTheDocument();
    });

    it("opens the list in place, each line with why it was left out", () => {
      mocks.workedOut = workedOut;

      render(<NutritionCard />);
      openList();

      expect(screen.getByTestId("nutrition-left-out-toggle")).toHaveAttribute(
        "aria-expanded",
        "true"
      );
      expect(listed()).toEqual([
        "olive oil for fryingreasons.noAmount",
        "1 tl komijnreasons.noSpoonWeight",
        "a mysteryreasons.noNumbers",
        "salt to tastereasons.seasoning",
      ]);
    });

    it("links only the lines whose fix is a fact in the food's panel, and opens it in place", () => {
      mocks.workedOut = workedOut;

      render(<NutritionCard />);
      openList();

      expect(screen.getByText("1 tl komijn").tagName).toBe("BUTTON");
      expect(screen.getByText("olive oil for frying").tagName).toBe("SPAN");
      expect(screen.getByText("a mystery").tagName).toBe("SPAN");
      expect(screen.getByText("salt to taste").tagName).toBe("SPAN");
      expect(screen.queryByTestId("ingredient-panel")).not.toBeInTheDocument();
      fireEvent.click(screen.getByText("1 tl komijn"));
      expect(screen.getByTestId("ingredient-panel")).toHaveTextContent("cumin");
      expect(mocks.panel).toEqual({ id: "cumin", open: true });
    });

    it("marks the lines the language model estimated as its own, in the same list", () => {
      mocks.workedOut = {
        ...workedOut,
        leftOut: [
          left("line-1", "olive oil for frying", "olive-oil", "no-amount", true),
          left("line-4", "salt to taste", "salt", "seasoning"),
        ],
      };

      render(<NutritionCard />);
      openList();

      expect(listed()).toEqual([
        "olive oil for fryingestimatedByAI",
        "salt to tastereasons.seasoning",
      ]);
    });

    it("shows no mark and no list where every line counted", () => {
      mocks.workedOut = { ...workedOut, estimated: false, leftOut: [] };

      render(<NutritionCard />);

      expect(mocks.marked).toBe(false);
      expect(screen.queryByTestId("nutrition-estimated")).not.toBeInTheDocument();
      expect(screen.queryByTestId("nutrition-left-out-toggle")).not.toBeInTheDocument();
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

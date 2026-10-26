/**
 * Cooking a recipe whose steps link other recipes: cooking mode walks the
 * linked recipes' steps in place, after the step that links each one, and
 * its ingredients view lists their lines after the recipe's own — ticked
 * apart, and kept while the cook moves between the two views.
 */
import { CookingIngredientsView } from "@/app/(app)/recipes/[id]/components/cookingmode/cooking-ingredients-view";
import CookingMode from "@/app/(app)/recipes/[id]/components/cookingmode/cooking-mode";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import {
  expandLinkedRecipes,
  linkedRecipeScaleFactor,
  scaleIngredientAmounts,
} from "@norish/shared/lib/linked-recipes";

function recipe(
  id: string,
  name: string,
  steps: string[],
  lines: [string, number][] = []
): FullRecipeDTO {
  return {
    id,
    name,
    servings: 2,
    systemUsed: "metric",
    categories: [],
    totalMinutes: 30,
    images: [],
    image: null,
    dishColor: null,
    steps: steps.map((step, order) => ({
      step,
      systemUsed: "metric",
      order,
      images: [],
      stepIngredients: [],
    })),
    recipeIngredients: lines.map(([ingredientName, amount], order) => ({
      ingredientName,
      amount,
      unit: "g",
      systemUsed: "metric",
      order,
    })),
  } as unknown as FullRecipeDTO;
}

const DOUGH = recipe("dough-1", "Pizza Dough", ["# Mixing", "Mix", "Knead"], [["flour", 500]]);
const PIZZA = recipe(
  "pizza-1",
  "Margherita",
  ["Make the [Pizza Dough](id:dough-1)", "Bake"],
  [["mozzarella", 125]]
);

const state = vi.hoisted(() => ({ currentServings: 2, root: null as unknown }));

/** The recipe being cooked: the Margherita unless a test picks another. */
const cooked = () => (state.root as FullRecipeDTO | null) ?? PIZZA;

// The dialog shows what cooking mode hands it: the steps in order, with the
// recipe each comes from, and the linked lines with their ticks.
type DialogProps = {
  steps: { text: string; heading?: string; linkedFrom?: { recipeName: string } }[];
  linkedIngredients: {
    recipe: { id: string; name: string };
    ingredients: { ingredientName: string; amount: number | null }[];
  }[];
  checkedLinkedIngredients: Record<string, Set<number>>;
  onCheckedLinkedIngredientsChange: (recipeId: string, indices: Set<number>) => void;
  onClose: () => void;
};

function dialog(props: DialogProps) {
  return (
    <div data-testid="cooking-dialog">
      <ol aria-label="steps">
        {props.steps.map((step, index) => (
          <li key={index}>
            {[step.linkedFrom?.recipeName ?? "-", step.heading ?? "-", step.text].join(" | ")}
          </li>
        ))}
      </ol>
      <ul aria-label="linked lines">
        {props.linkedIngredients.flatMap(({ recipe: linked, ingredients }) =>
          ingredients.map((line) => (
            <li key={`${linked.id}-${line.ingredientName}`}>
              {`${linked.name}: ${line.amount} ${line.ingredientName}`}
            </li>
          ))
        )}
      </ul>
      <output aria-label="ticked">
        {JSON.stringify(
          Object.fromEntries(
            Object.entries(props.checkedLinkedIngredients).map(([id, set]) => [id, [...set]])
          )
        )}
      </output>
      <button
        type="button"
        onClick={() => props.onCheckedLinkedIngredientsChange("dough-1", new Set([0]))}
      >
        tick-flour
      </button>
      <button type="button" onClick={props.onClose}>
        close-cooking
      </button>
    </div>
  );
}

vi.mock("@/app/(app)/recipes/[id]/context", () => ({
  useRecipeContextRequired: () => ({
    adjustedIngredients: [],
    currentServings: state.currentServings,
    recipe: cooked(),
  }),
}));
vi.mock("@/app/(app)/recipes/[id]/components/use-recipe-linked-recipes", () => ({
  useRecipeLinkedRecipes: () => {
    const scale = linkedRecipeScaleFactor(cooked().servings, state.currentServings);

    return {
      tree: expandLinkedRecipes(cooked(), new Map([[DOUGH.id, DOUGH]]), { systemUsed: "metric" }),
      ingredientsFor: (linked: FullRecipeDTO) =>
        scaleIngredientAmounts(linked.recipeIngredients, scale),
    };
  },
}));
vi.mock("@/app/(app)/recipes/[id]/components/cookingmode/mobile-cooking-mode-dialog", () => ({
  MobileCookingModeDialog: (props: DialogProps) => dialog(props),
}));
vi.mock("@/app/(app)/recipes/[id]/components/cookingmode/desktop-cooking-mode-dialog", () => ({
  DesktopCookingModeDialog: (props: DialogProps) => dialog(props),
}));
vi.mock("@/app/(app)/recipes/[id]/components/cookingmode/use-is-desktop-cooking-mode", () => ({
  useIsDesktopCookingMode: () => false,
}));
vi.mock("@/app/(app)/recipes/[id]/components/wake-lock-context", () => ({
  useWakeLockContext: () => ({
    isSupported: false,
    isActive: false,
    enable: vi.fn(),
    disable: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => true }));
vi.mock("@/hooks/auto-hide", () => ({ useAutoHide: () => ({ isVisible: true }) }));
vi.mock("@/context/device-preferences-context", async () =>
  (await import("../../helpers/device-preferences-mock")).mockDevicePreferences(() => ({
    recipePageColor: "theme",
  }))
);
vi.mock("@/components/timer-dock", () => ({ TimerDock: () => <div /> }));
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");

  return {
    ...actual,
    motion: {
      ...actual.motion,
      div: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    },
    useReducedMotion: () => true,
  };
});
vi.mock("@heroui/react", async () => {
  const actual = await vi.importActual<typeof import("@heroui/react")>("@heroui/react");

  return {
    ...actual,
    Modal: {
      Backdrop: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
        isOpen ? <div>{children}</div> : null,
      Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    },
  };
});
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace: string) => (key: string, params?: Record<string, unknown>) =>
    params ? `${namespace}.${key}(${Object.values(params).join(",")})` : `${namespace}.${key}`,
}));
// The ingredients view's controls are the recipe page's own, tested there.
vi.mock("@/app/(app)/recipes/[id]/components/servings-control", () => ({ default: () => null }));
vi.mock("@/app/(app)/recipes/[id]/components/system-convert-menu", () => ({
  default: () => null,
}));
vi.mock("@/components/recipes/amount-display-toggle", () => ({ default: () => null }));
vi.mock("@/components/shared/smart-markdown-renderer", () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));
vi.mock("@/hooks/use-amount-display-preference", () => ({
  useAmountDisplayPreference: () => ({ mode: "decimal" }),
}));
vi.mock("@/hooks/use-unit-formatter", () => ({
  useUnitFormatter: () => ({ formatUnitOnly: (unit: string | null) => unit ?? "" }),
}));

beforeEach(() => {
  state.currentServings = 2;
  state.root = null;
});

function openCooking() {
  fireEvent.click(screen.getByText("recipes.detail.cook"));
}

describe("Cooking mode with linked recipes", () => {
  it("cooks the linked recipe's steps after the step that links it", () => {
    render(<CookingMode />);
    openCooking();

    const steps = within(screen.getByRole("list", { name: "steps" }))
      .getAllByRole("listitem")
      .map((item) => item.textContent);

    expect(steps).toEqual([
      "- | - | Make the [Pizza Dough](id:dough-1)",
      "Pizza Dough | Mixing | Mix",
      "Pizza Dough | Mixing | Knead",
      "- | - | Bake",
    ]);
  });

  it("leaves out a step that only names the linked recipe, cooking its steps instead", () => {
    state.root = recipe("calzone-1", "Calzone", ["[Pizza Dough](id:dough-1)", "Fold and bake"]);
    render(<CookingMode />);
    openCooking();

    expect(
      within(screen.getByRole("list", { name: "steps" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual([
      "Pizza Dough | Mixing | Mix",
      "Pizza Dough | Mixing | Knead",
      "- | - | Fold and bake",
    ]);
  });

  it("lists the linked recipe's lines, scaled with the servings chosen", () => {
    state.currentServings = 4;
    render(<CookingMode />);
    openCooking();

    expect(
      within(screen.getByRole("list", { name: "linked lines" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual(["Pizza Dough: 1000 flour"]);
  });

  it("keeps linked ticks for the session and clears them for a new one", () => {
    render(<CookingMode />);
    openCooking();

    expect(screen.getByRole("status", { name: "ticked" })).toHaveTextContent("{}");
    fireEvent.click(screen.getByText("tick-flour"));
    expect(screen.getByRole("status", { name: "ticked" })).toHaveTextContent('{"dough-1":[0]}');

    fireEvent.click(screen.getByText("close-cooking"));
    openCooking();

    expect(screen.getByRole("status", { name: "ticked" })).toHaveTextContent("{}");
  });
});

describe("Cooking mode's ingredients view with linked recipes", () => {
  const recipeProps = {
    id: "pizza-1",
    name: "Margherita",
    image: null,
    categories: [],
    totalMinutes: 30,
    servings: 2,
    systemUsed: "metric",
  };
  const linked = [
    {
      recipe: { id: "dough-1", name: "Pizza Dough", systemUsed: "metric" },
      ingredients: [
        { ingredientName: "flour", amount: 500, unit: "g", systemUsed: "metric", order: 0 },
      ],
    },
  ];

  it("lists linked lines under the recipe they come from and reports their ticks apart", () => {
    const onLinked = vi.fn();
    const onOwn = vi.fn();

    render(
      <CookingIngredientsView
        showTitle
        checkedIngredients={new Set()}
        checkedLinkedIngredients={{}}
        displayIngredients={[
          { ingredientName: "mozzarella", amount: 125, unit: "g", systemUsed: "metric", order: 0 },
        ]}
        linkedIngredients={linked}
        recipe={recipeProps}
        onCheckedIngredientsChange={onOwn}
        onCheckedLinkedIngredientsChange={onLinked}
      />
    );

    const section = screen.getByTestId("linked-recipe-ingredients");

    expect(within(section).getByRole("link", { name: "Pizza Dough" })).toHaveAttribute(
      "href",
      "/recipes/dough-1"
    );

    act(() => {
      fireEvent.click(within(section).getByRole("button", { name: /flour/ }));
    });

    expect(onLinked).toHaveBeenCalledWith("dough-1", new Set([0]));
    expect(onOwn).not.toHaveBeenCalled();
  });

  it("shows a ticked linked line as ticked", () => {
    render(
      <CookingIngredientsView
        showTitle
        checkedIngredients={new Set()}
        checkedLinkedIngredients={{ "dough-1": new Set([0]) }}
        displayIngredients={[]}
        linkedIngredients={linked}
        recipe={recipeProps}
        onCheckedIngredientsChange={vi.fn()}
        onCheckedLinkedIngredientsChange={vi.fn()}
      />
    );

    expect(
      within(screen.getByTestId("linked-recipe-ingredients")).getByRole("button", {
        name: /flour/,
      })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("adds no linked section when nothing is linked", () => {
    render(
      <CookingIngredientsView
        showTitle
        checkedIngredients={new Set()}
        checkedLinkedIngredients={{}}
        displayIngredients={[]}
        linkedIngredients={[]}
        recipe={recipeProps}
        onCheckedIngredientsChange={vi.fn()}
        onCheckedLinkedIngredientsChange={vi.fn()}
      />
    );

    expect(screen.queryByTestId("linked-recipe-ingredients")).not.toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import RecipePageMobile from "@/app/(app)/recipes/[id]/recipe-page-mobile";

type MockRecipe = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  url: string | null;
  categories: string[];
  tags: { name: string }[];
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  notes: string | null;
  servings: number;
  systemUsed: "metric" | "us";
  recipeIngredients: { systemUsed: "metric" | "us" }[];
  calories: number | null;
  fat: string | null;
  carbs: string | null;
  protein: string | null;
  originCountry: string | null;
  originRegion: string | null;
  provenanceNote: string | null;
  cuisines: { id: string; name: string; version: number }[];
  author?: undefined;
};

const baseRecipe = (): MockRecipe => ({
  id: "recipe-1",
  userId: "owner-1",
  name: "Cacio e Pepe",
  description: null,
  url: null,
  categories: [],
  tags: [],
  prepMinutes: null,
  cookMinutes: null,
  totalMinutes: null,
  notes: "Serve immediately.",
  servings: 2,
  systemUsed: "metric",
  // Both systems present, so the conversion menu has two options to offer.
  recipeIngredients: [{ systemUsed: "metric" }, { systemUsed: "us" }],
  calories: 520,
  fat: "18",
  carbs: "60",
  protein: "20",
  originCountry: "IT",
  originRegion: "Lazio",
  provenanceNote: "Una classica ricetta romana.",
  cuisines: [],
});

const mocks = vi.hoisted(() => ({
  recipe: {} as Record<string, unknown>,
  busyKinds: new Set<string>(),
  hidden: [] as string[],
}));

vi.mock("@/app/(app)/recipes/[id]/context", () => {
  const context = () => ({
    recipe: mocks.recipe,
    currentServings: 2,
    allergies: [],
    allergySet: new Set<string>(),
    convertingTo: null,
    startConversion: vi.fn(),
    enrichment: {
      isBusy: (kind: string) => mocks.busyKinds.has(kind),
    },
  });

  return { useRecipeContext: context, useRecipeContextRequired: context };
});

vi.mock("@/app/(app)/recipes/[id]/components/actions-menu", () => ({
  default: () => <div data-testid="actions-menu" />,
}));
vi.mock("@/app/(app)/recipes/[id]/components/add-to-groceries-button", () => ({
  default: () => <div data-testid="add-to-groceries" />,
}));
vi.mock("@/app/(app)/recipes/[id]/components/cookingmode", () => ({
  default: () => <div data-testid="cooking-mode" />,
}));
vi.mock("@/app/(app)/recipes/[id]/components/ingredient-list", () => ({
  default: () => <div data-testid="ingredients-list" />,
}));
vi.mock("@/app/(app)/recipes/[id]/components/servings-control", () => ({
  default: () => <div data-testid="servings-control" />,
}));
vi.mock("@/app/(app)/recipes/[id]/components/steps-list", () => ({
  default: () => <div data-testid="steps-list" />,
}));
vi.mock("@/components/recipes/amount-display-toggle", () => ({
  default: () => <div data-testid="amount-display-toggle" />,
}));
vi.mock("@/components/recipes/author-chip", () => ({
  default: () => <div data-testid="author-chip" />,
}));
vi.mock("@/components/recipes/nutrition-portion-control", () => ({
  default: () => <div data-testid="nutrition-portion-control" />,
}));
vi.mock("@/components/shared/media-carousel", () => ({
  default: () => <div data-testid="media-carousel" />,
  buildMediaItems: () => [],
}));
vi.mock("@/components/shared/smart-markdown-renderer", () => ({
  default: ({ text }: { text: string }) => <div>{text}</div>,
}));
// The summary stays real so the origin flag beside the title renders — the
// page suite asserts the flag survives a hidden Recipe Provenance section.
vi.mock("@/components/recipes/readonly-recipe-sections", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/recipes/readonly-recipe-sections")>();

  return {
    // The page decides what floats on the media, so the mock renders the
    // overlay slots it was handed — the heart lives in the top-right one.
    ReadonlyRecipeMedia: ({
      topLeftContent,
      topRightContent,
    }: {
      topLeftContent?: React.ReactNode;
      topRightContent?: React.ReactNode;
    }) => (
      <div data-testid="recipe-media">
        {topLeftContent}
        {topRightContent}
      </div>
    ),
    ReadonlyRecipeNotes: () => <div data-testid="recipe-notes" />,
    ReadonlyRecipeSummary: (props: Parameters<typeof actual.ReadonlyRecipeSummary>[0]) => (
      <div data-testid="recipe-summary">
        <actual.ReadonlyRecipeSummary {...props} />
      </div>
    ),
  };
});
vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => ({ isAIEnabled: false }),
}));
vi.mock("@/components/shared/double-tap-container", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/shared/heart-button", () => ({
  default: () => <div data-testid="heart-button" />,
}));
vi.mock("@norish/ui/star-rating", () => ({
  default: () => <div data-testid="star-rating" />,
}));

vi.mock("@/context/user-context", () => ({
  useUserContext: () => ({ user: { id: "owner-1", preferences: { hidden: mocks.hidden } } }),
}));
vi.mock("@/hooks/favorites", () => ({
  useFavoritesQuery: () => ({ isFavorite: () => false }),
  useFavoritesMutation: () => ({ toggleFavorite: vi.fn() }),
}));
vi.mock("@/hooks/ratings", () => ({
  useRatingQuery: () => ({ userRating: null, averageRating: null, isLoading: false }),
  useRatingsMutation: () => ({ rateRecipe: vi.fn(), isRating: false }),
}));
vi.mock("@heroui/react", () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  Card: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Content: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="page-sections">{children}</div>
    ),
  }),
  Chip: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Dropdown: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Trigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Menu: ({
      children,
      items = [],
    }: {
      children: React.ReactNode | ((item: unknown) => React.ReactNode);
      items?: unknown[];
    }) => <div>{typeof children === "function" ? items.map(children) : children}</div>,
    Item: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
  Label: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
  Separator: () => <hr />,
  Skeleton: () => <span data-testid="skeleton" />,
  Spinner: () => <span data-testid="spinner" />,
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

beforeEach(() => {
  mocks.recipe = baseRecipe();
  mocks.busyKinds = new Set();
  mocks.hidden = [];
});

/** Marker elements for each section, in the order they appear in the DOM. */
function sectionMarkers(): HTMLElement[] {
  const markers: (HTMLElement | null)[] = [
    screen.getByTestId("recipe-summary"),
    screen.getByTestId("cooking-mode"),
    screen.queryByRole("heading", { name: /Italia/ }),
    screen.queryByText("recipes.detail.ingredients"),
    screen.queryByText("recipes.detail.notes"),
    screen.getByText("recipes.detail.steps"),
    screen.queryByText("recipes.nutrition.title"),
  ];

  return markers.filter((el): el is HTMLElement => el !== null);
}

function expectMarkersInDocumentOrder(markers: HTMLElement[]) {
  for (let i = 0; i < markers.length - 1; i++) {
    const position = markers[i].compareDocumentPosition(markers[i + 1]);

    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
}

function separators(): HTMLElement[] {
  return screen.getAllByRole("separator");
}

function expectNoDoubledRules() {
  for (const separator of separators()) {
    expect(separator.nextElementSibling?.tagName).not.toBe("HR");
    expect(separator.previousElementSibling?.tagName).not.toBe("HR");
  }
}

describe("RecipePageMobile section layout", () => {
  it("orders sections summary → cooking mode → provenance → ingredients → notes → steps → nutrition", () => {
    render(<RecipePageMobile />);

    const markers = sectionMarkers();

    // All seven sections are present for the full fixture.
    expect(markers).toHaveLength(7);
    expectMarkersInDocumentOrder(markers);
  });

  it("draws exactly one rule between adjacent sections", () => {
    render(<RecipePageMobile />);

    // Six boundaries follow the header group: cooking mode | provenance |
    // ingredients | notes | steps | nutrition — five rules, one each.
    expect(separators()).toHaveLength(5);
    expectNoDoubledRules();
  });

  it("keeps a single rule where provenance is absent", () => {
    mocks.recipe = {
      ...baseRecipe(),
      originCountry: null,
      originRegion: null,
      provenanceNote: null,
    };

    render(<RecipePageMobile />);

    expect(screen.queryByRole("heading", { name: /Italia/ })).not.toBeInTheDocument();
    // One fewer boundary, one fewer rule — and never two rules in a row.
    expect(separators()).toHaveLength(4);
    expectNoDoubledRules();
  });

  it("shows provenance while a run is in flight, before the ingredients", () => {
    mocks.recipe = {
      ...baseRecipe(),
      originCountry: null,
      originRegion: null,
      provenanceNote: null,
    };
    mocks.busyKinds = new Set(["recipe-provenance"]);

    render(<RecipePageMobile />);

    const provenanceTitle = screen.getByText("recipes.provenance.title");
    const ingredientsTitle = screen.getByText("recipes.detail.ingredients");
    const position = provenanceTitle.compareDocumentPosition(ingredientsTitle);

    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(separators()).toHaveLength(5);
    expectNoDoubledRules();
  });

  it("draws no trailing rule when the nutrition section is absent", () => {
    mocks.recipe = { ...baseRecipe(), calories: null, fat: null, carbs: null, protein: null };

    render(<RecipePageMobile />);

    expect(screen.queryByText("recipes.nutrition.title")).not.toBeInTheDocument();
    expect(separators()).toHaveLength(4);

    const sections = screen.getByTestId("page-sections");

    expect(sections.lastElementChild?.tagName).not.toBe("HR");
  });

  it("omits the notes boundary when the recipe has no notes", () => {
    mocks.recipe = { ...baseRecipe(), notes: null };

    render(<RecipePageMobile />);

    expect(screen.queryByText("recipes.detail.notes")).not.toBeInTheDocument();
    expect(separators()).toHaveLength(4);
    expectNoDoubledRules();
  });
});

describe("RecipePageMobile hidden items", () => {
  it("shows the rating section to a reader who has hidden nothing", () => {
    render(<RecipePageMobile />);

    expect(screen.getByText("recipes.detail.ratingPrompt")).toBeInTheDocument();
  });

  it("drops the rating section for a reader who has hidden ratings", () => {
    mocks.hidden = ["rating"];

    render(<RecipePageMobile />);

    expect(screen.queryByText("recipes.detail.ratingPrompt")).not.toBeInTheDocument();
    // Hiding a section leaves no rule behind: the boundaries either side of the
    // steps are unchanged, because the rating sits inside that group.
    expect(separators()).toHaveLength(5);
    expectNoDoubledRules();
  });

  it("ignores a stored name it does not recognise", () => {
    mocks.hidden = ["something-newer"];

    render(<RecipePageMobile />);

    expect(sectionMarkers()).toHaveLength(7);
    expect(screen.getByText("recipes.detail.ratingPrompt")).toBeInTheDocument();
  });

  it("drops the provenance section but keeps the origin flag beside the title", () => {
    mocks.hidden = ["provenance"];

    render(<RecipePageMobile />);

    expect(screen.queryByRole("heading", { name: /Italia/ })).not.toBeInTheDocument();
    // The flag beside the recipe title is chrome, not Recipe Provenance.
    expect(screen.getByText("🇮🇹")).toBeInTheDocument();
    expect(separators()).toHaveLength(4);
    expectNoDoubledRules();
  });

  it("keeps a hidden provenance section absent even while a run is in flight", () => {
    mocks.hidden = ["provenance"];
    mocks.busyKinds = new Set(["recipe-provenance"]);

    render(<RecipePageMobile />);

    expect(screen.queryByText("recipes.provenance.title")).not.toBeInTheDocument();
    expect(separators()).toHaveLength(4);
    expectNoDoubledRules();
  });

  it("drops the whole nutrition card for a reader who has hidden nutrition", () => {
    mocks.hidden = ["nutrition"];

    render(<RecipePageMobile />);

    // The four values leave together — never one tile of four.
    expect(screen.queryByText("recipes.nutrition.title")).not.toBeInTheDocument();
    expect(screen.queryByText("recipes.nutrition.calories")).not.toBeInTheDocument();
    expect(separators()).toHaveLength(4);

    const sections = screen.getByTestId("page-sections");

    expect(sections.lastElementChild?.tagName).not.toBe("HR");
  });

  it("drops the notes section for a reader who has hidden notes", () => {
    mocks.hidden = ["notes"];

    render(<RecipePageMobile />);

    expect(screen.queryByText("recipes.detail.notes")).not.toBeInTheDocument();
    expect(screen.queryByTestId("recipe-notes")).not.toBeInTheDocument();
    expect(separators()).toHaveLength(4);
    expectNoDoubledRules();
  });

  it("shows the heart to a reader who has hidden nothing", () => {
    render(<RecipePageMobile />);

    expect(screen.getByTestId("heart-button")).toBeInTheDocument();
  });

  it("drops the heart for a reader who has hidden favourites", () => {
    mocks.hidden = ["favorites"];

    render(<RecipePageMobile />);

    expect(screen.queryByTestId("heart-button")).not.toBeInTheDocument();
  });

  it("shows the conversion menu to a reader who has hidden nothing", () => {
    render(<RecipePageMobile />);

    expect(screen.getByText("metric")).toBeInTheDocument();
  });

  it("drops the conversion menu for a reader who has hidden conversion", () => {
    mocks.hidden = ["conversion"];

    render(<RecipePageMobile />);

    expect(screen.queryByText("metric")).not.toBeInTheDocument();
  });
});

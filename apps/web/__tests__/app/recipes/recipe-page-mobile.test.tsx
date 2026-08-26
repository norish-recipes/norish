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
  servings: number | null;
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
  url: "https://example.test/cacio-e-pepe",
  categories: [],
  tags: [],
  prepMinutes: 10,
  cookMinutes: 20,
  totalMinutes: 30,
  notes: "Serve immediately.",
  servings: 2,
  systemUsed: "metric",
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

/** A recipe with nothing optional stored: no times, calories, notes or source. */
const bareRecipe = (): MockRecipe => ({
  ...baseRecipe(),
  url: null,
  prepMinutes: null,
  cookMinutes: null,
  totalMinutes: null,
  notes: null,
  calories: null,
  fat: null,
  carbs: null,
  protein: null,
  originCountry: null,
  originRegion: null,
  provenanceNote: null,
});

const mocks = vi.hoisted(() => ({
  recipe: {} as Record<string, unknown>,
  busyKinds: new Set<string>(),
  hidden: [] as string[],
  currentServings: 2,
}));

vi.mock("@/app/(app)/recipes/[id]/context", () => {
  const context = () => ({
    recipe: mocks.recipe,
    currentServings: mocks.currentServings,
    allergies: [],
    allergySet: new Set<string>(),
    convertingTo: null,
    startConversion: vi.fn(),
    setIngredientAmounts: vi.fn(),
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
  default: ({ floating }: { floating?: boolean }) => (
    <div data-floating={String(Boolean(floating))} data-testid="cooking-mode" />
  ),
}));
vi.mock("@/app/(app)/recipes/[id]/components/ingredient-list", () => ({
  default: () => <div data-testid="ingredients-list" />,
}));
vi.mock("@/app/(app)/recipes/[id]/components/ingredients-options-menu", () => ({
  default: () => <div data-testid="ingredients-options" />,
}));
vi.mock("@/app/(app)/recipes/[id]/components/servings-control", () => ({
  default: () => <div data-testid="servings-control" />,
}));
vi.mock("@/app/(app)/recipes/[id]/components/steps-list", () => ({
  default: () => <div data-testid="steps-list" />,
}));
vi.mock("@/components/Panel/consumers", () => ({
  MiniCookbooks: () => null,
}));

vi.mock("@/hooks/cookbooks", () => ({
  useRecipeCookbooksQuery: () => ({ cookbooks: [], isLoading: false }),
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
vi.mock("@/components/recipes/readonly-recipe-sections", () => ({
  // The page decides what floats on the media, so the mock renders the
  // overlay slots it was handed.
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
}));
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
  useUserContext: () => ({ user: { id: "owner-1" } }),
}));

vi.mock("@/context/hidden-items-context", () => ({
  useHiddenItems: () => mocks.hidden,
}));
// The way back reads the reader's lens and the page they came from, neither
// of which these tests set up — the cards under test are what they are about.
vi.mock("@/hooks/use-back-destination", () => ({
  useBackDestination: () => ({ href: "/", label: "Back to library" }),
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
  Card: Object.assign(
    ({ children }: { children: React.ReactNode }) => (
      <div data-testid="section-card">{children}</div>
    ),
    {
      Header: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    }
  ),
  Chip: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
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
  mocks.currentServings = 2;
});

const CARD_TITLES = {
  ingredients: "recipes.detail.ingredients",
  steps: "recipes.detail.steps",
  notes: "recipes.detail.notes",
  cookingTime: "recipes.cookingTime.title",
  nutrition: "recipes.nutrition.title",
  source: "recipes.detail.source",
  cookbooks: "recipes.cookbooks.cardTitle",
  rating: "recipes.detail.ratingPrompt",
} as const;

/** Every card that rendered, in the order it appears in the DOM. */
function cardTitlesInOrder(): string[] {
  const found = Object.values(CARD_TITLES)
    .map((title) => screen.queryByText(title))
    .filter((element): element is HTMLElement => element !== null);
  const provenance =
    screen.queryByRole("heading", { name: /Italia/ }) ??
    screen.queryByText("recipes.provenance.title");

  const all = provenance ? [...found, provenance] : found;

  return all
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map((element) => element.textContent ?? "");
}

function cardCount(): number {
  return screen.queryAllByTestId("section-card").length;
}

/**
 * The phone page is a header followed by one card per section, in cooking
 * order. A section with nothing stored and nothing running draws no card, so
 * absence renders as a slimmer page rather than as an empty box.
 */
describe("RecipePageMobile card body", () => {
  it("orders the cards ingredients → steps → notes → cooking time → nutrition → provenance → source → cookbooks → rating", () => {
    render(<RecipePageMobile />);

    expect(cardTitlesInOrder()).toEqual([
      CARD_TITLES.ingredients,
      CARD_TITLES.steps,
      CARD_TITLES.notes,
      CARD_TITLES.cookingTime,
      CARD_TITLES.nutrition,
      "🇮🇹Italia",
      CARD_TITLES.source,
      CARD_TITLES.cookbooks,
      CARD_TITLES.rating,
    ]);
  });

  it("draws no rules between the sections", () => {
    render(<RecipePageMobile />);

    expect(screen.queryAllByRole("separator")).toHaveLength(0);
  });

  it("renders the rating outside the steps card", () => {
    render(<RecipePageMobile />);

    const stepsCard = screen.getByText(CARD_TITLES.steps).closest("[data-testid='section-card']");

    expect(stepsCard).not.toBeNull();
    expect(stepsCard).not.toContainElement(screen.getByTestId("star-rating"));
  });

  it("keeps ingredients and steps for a recipe that stores nothing else", () => {
    mocks.recipe = bareRecipe();

    render(<RecipePageMobile />);

    expect(cardTitlesInOrder()).toEqual([
      CARD_TITLES.ingredients,
      CARD_TITLES.steps,
      CARD_TITLES.cookbooks,
      CARD_TITLES.rating,
    ]);
    // Four cards: the three with something in them, plus the cookbooks card,
    // which is an invitation rather than a stored section and so is drawn even
    // for a recipe that stores nothing else.
    expect(cardCount()).toBe(4);
  });

  it("renders a section with a run in flight as working", () => {
    mocks.recipe = bareRecipe();
    mocks.busyKinds = new Set(["recipe-provenance"]);

    render(<RecipePageMobile />);

    expect(screen.getByText("recipes.provenance.title")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("keeps provenance after the cooking, not before the ingredients", () => {
    render(<RecipePageMobile />);

    const ingredients = screen.getByText(CARD_TITLES.ingredients);
    const provenance = screen.getByRole("heading", { name: /Italia/ });

    expect(
      ingredients.compareDocumentPosition(provenance) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("floats the cook control outside every card", () => {
    render(<RecipePageMobile />);

    const cook = screen.getByTestId("cooking-mode");

    expect(cook.dataset.floating).toBe("true");
    expect(cook.closest("[data-testid='section-card']")).toBeNull();
  });

  it("gives the ingredients card a servings row", () => {
    render(<RecipePageMobile />);

    const ingredientsCard = screen
      .getByText(CARD_TITLES.ingredients)
      .closest("[data-testid='section-card']");

    expect(ingredientsCard).toContainElement(screen.getByTestId("servings-control"));
  });
});

describe("RecipePageMobile hidden items", () => {
  it("shows the rating card to a reader who has hidden nothing", () => {
    render(<RecipePageMobile />);

    expect(screen.getByText(CARD_TITLES.rating)).toBeInTheDocument();
  });

  it("drops the rating card for a reader who has hidden ratings", () => {
    mocks.hidden = ["rating"];

    render(<RecipePageMobile />);

    expect(screen.queryByText(CARD_TITLES.rating)).not.toBeInTheDocument();
  });

  it("ignores a stored name it does not recognise", () => {
    mocks.hidden = ["something-newer"];

    render(<RecipePageMobile />);

    expect(cardTitlesInOrder()).toHaveLength(9);
  });

  it("drops the provenance card but keeps the origin flag beside the title", () => {
    mocks.hidden = ["provenance"];

    render(<RecipePageMobile />);

    expect(screen.queryByRole("heading", { name: /Italia/ })).not.toBeInTheDocument();
    // The flag beside the recipe title is chrome, not Recipe Provenance.
    expect(screen.getByText("🇮🇹")).toBeInTheDocument();
  });

  it("keeps a hidden provenance card absent even while a run is in flight", () => {
    mocks.hidden = ["provenance"];
    mocks.busyKinds = new Set(["recipe-provenance"]);

    render(<RecipePageMobile />);

    expect(screen.queryByText("recipes.provenance.title")).not.toBeInTheDocument();
  });

  it("takes the calories out of the Glance Bar with the nutrition card", () => {
    mocks.hidden = ["nutrition"];

    render(<RecipePageMobile />);

    // The card and its Glance Bar entry leave together — a bar restating a
    // hidden fact is exactly the bug a restating bar invites.
    expect(screen.queryByText(CARD_TITLES.nutrition)).not.toBeInTheDocument();
    expect(screen.queryByText("recipes.nutrition.calories")).not.toBeInTheDocument();
    expect(screen.queryByText("520")).not.toBeInTheDocument();
    // The rest of the bar is untouched.
    expect(screen.getByText("recipes.glanceBar.totalTime")).toBeInTheDocument();
  });

  it("reads the Glance Bar's servings off the scaled figure, not the stored one", () => {
    mocks.currentServings = 5;

    render(<RecipePageMobile />);

    // The bar restates what the sections below render, so it cannot disagree
    // with the stepper an inch under it. Read off the bar's own entry, since
    // the stepper is showing the same figure elsewhere on the page.
    const entry = screen.getByText("recipes.glanceBar.servings").parentElement;

    expect(entry?.textContent).toContain("5");
  });

  it("drops the notes card for a reader who has hidden notes", () => {
    mocks.hidden = ["notes"];

    render(<RecipePageMobile />);

    expect(screen.queryByText(CARD_TITLES.notes)).not.toBeInTheDocument();
    expect(screen.queryByTestId("recipe-notes")).not.toBeInTheDocument();
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
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import RecipePageDesktop from "@/app/(app)/recipes/[id]/recipe-page-desktop";
import RecipePageMobile from "@/app/(app)/recipes/[id]/recipe-page-mobile";

import { onRecipePage } from "../../helpers/recipe-page";

const userPreferencesState = {
  hidden: ["favorites"] as string[],
};

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock("@norish/shared-react/reader", async () =>
  (await import("../../helpers/reader-mock")).mockDevicePreferences(
    () => ({
      hiddenItems: userPreferencesState.hidden,
    }),
    {
      reader: () => ({ user: { id: "owner-1" } }),
    }
  )
);

const stubRecipe = {
  id: "r1",
  name: "Recipe",
  url: null,
  description: "desc",
  categories: [],
  prepMinutes: 10,
  cookMinutes: 20,
  totalMinutes: 30,
  tags: [],
  author: null,
  notes: null,
  servings: 2,
  systemUsed: null,
};

vi.mock("@/components/Panel/consumers", () => ({
  MiniCookbooks: () => null,
}));

// The worked-out total reads the server; these pages are about their layout.
vi.mock("@/hooks/recipes/use-worked-out-nutrition", () => ({
  useWorkedOutNutrition: () => null,
}));

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("../../helpers/trpc-fake")).mockTRPC()
);

// The way back reads the reader's lens and the page they came from, neither
// of which these tests set up — the cards under test are what they are about.
vi.mock("@/hooks/use-back-destination", () => ({
  useBackDestination: () => ({ href: "/", label: "Back to library" }),
}));

vi.mock("@/components/shared/double-tap-container", () => ({
  default: ({ children, disabled, doubleTapEnabled }: any) => (
    <div
      data-disabled={String(Boolean(disabled))}
      data-doubletap-enabled={String(doubleTapEnabled !== false)}
      data-testid="double-tap-container"
    >
      {children}
    </div>
  ),
}));

vi.mock("@/components/shared/heart-button", () => ({
  default: () => <div data-testid="heart-button" />,
}));

vi.mock("@norish/ui/star-rating", () => ({
  default: () => <div>star-rating</div>,
}));

vi.mock("@/components/shared/media-carousel", () => ({
  default: () => <div>media-carousel</div>,
  buildMediaItems: () => [],
}));

vi.mock("@/app/(app)/recipes/[id]/components/provenance-card", () => ({
  default: () => <div>provenance-card</div>,
  useProvenanceSectionVisible: () => true,
}));

vi.mock("@/app/(app)/recipes/[id]/components/nutrition-card", () => ({
  default: () => <div>nutrition-card</div>,
  useNutritionSectionVisible: () => true,
}));

vi.mock("@/app/(app)/recipes/[id]/components/notes-card", () => ({
  default: () => <div>notes-card</div>,
  useNotesSectionVisible: () => false,
}));

vi.mock("@/app/(app)/recipes/[id]/components/actions-menu", () => ({
  default: () => <div>actions-menu</div>,
}));
vi.mock("@/app/(app)/recipes/[id]/components/add-to-groceries-button", () => ({
  default: () => <div>add-groceries</div>,
}));
vi.mock("@/app/(app)/recipes/[id]/components/ingredient-list", () => ({
  default: () => <div>ingredients-list</div>,
}));
vi.mock("@/app/(app)/recipes/[id]/components/ingredients-options-menu", () => ({
  default: () => <div data-testid="ingredients-options" />,
}));
vi.mock("@/app/(app)/recipes/[id]/components/servings-control", () => ({
  default: () => <div>servings-control</div>,
}));
vi.mock("@/components/recipes/amount-display-toggle", () => ({
  default: () => <div>amount-toggle</div>,
}));
vi.mock("@/app/(app)/recipes/[id]/components/cookingmode", () => ({
  default: () => <div>cooking-mode</div>,
}));
vi.mock("@/app/(app)/recipes/[id]/components/steps-list", () => ({
  default: () => <div>steps-list</div>,
}));
vi.mock("@/app/(app)/recipes/[id]/components/system-convert-menu", () => ({
  default: () => <div>system-convert-menu</div>,
}));
vi.mock("@/app/(app)/recipes/[id]/components/wake-lock-toggle", () => ({
  default: () => <div>wake-lock-toggle</div>,
}));
vi.mock("@/components/recipes/author-chip", () => ({
  default: () => <div>author-chip</div>,
}));

function renderOnPage(ui: React.ReactElement, recipe: object = stubRecipe) {
  return render(ui, { wrapper: onRecipePage({ ...recipe, id: "r1" }).wrapper });
}

describe("recipe pages favorite visibility", () => {
  it("keeps tap interactions enabled on desktop when favorites are hidden", () => {
    userPreferencesState.hidden = ["favorites"];

    renderOnPage(<RecipePageDesktop onPrint={() => {}} />);

    expect(screen.getByTestId("double-tap-container")).toHaveAttribute("data-disabled", "false");
    expect(screen.getByTestId("double-tap-container")).toHaveAttribute(
      "data-doubletap-enabled",
      "false"
    );
  });

  it("keeps tap interactions enabled on mobile when favorites are hidden", () => {
    userPreferencesState.hidden = ["favorites"];

    renderOnPage(<RecipePageMobile onPrint={() => {}} />);

    expect(screen.getByTestId("double-tap-container")).toHaveAttribute("data-disabled", "false");
    expect(screen.getByTestId("double-tap-container")).toHaveAttribute(
      "data-doubletap-enabled",
      "false"
    );
  });
});

describe("recipe page servings", () => {
  it("leaves a recipe without servings out of the ingredients header on desktop", () => {
    renderOnPage(<RecipePageDesktop onPrint={() => {}} />, { ...stubRecipe, servings: 0 });

    expect(screen.queryByText("servings-control")).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});

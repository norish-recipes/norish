// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const seen = vi.hoisted(() => ({ cards: [] as string[] }));

vi.mock("@/hooks/use-card-actions", () => ({ useCardActions: () => ({}) }));
vi.mock("@norish/shared-react/reader", () => ({ useDevicePreference: () => ["grid", () => {}] }));
vi.mock("@norish/shared-react/recipes", () => ({
  useLibraryCards: () => ({ isFavorite: () => false, allergies: [] }),
  useLibraryFilters: () => ({}),
}));
vi.mock("@norish/shared/contracts/filter-contract", () => ({
  hasAppliedRecipeFilters: () => false,
}));
vi.mock("@/features/recipes/components/library-skeleton", () => ({ LibrarySkeleton: () => null }));
vi.mock("@/features/recipes/components/library-states", () => ({ LibraryNoResults: () => null }));
// Draws each row's card in the variant the list hands it.
vi.mock("@/features/recipes/components/card-list", () => ({
  CardList: ({
    rows,
    variant,
    renderCard,
  }: {
    rows: unknown[];
    variant: string;
    renderCard: (row: unknown, shown: string) => ReactNode;
  }) => rows.map((row) => <div key={String(row)}>{renderCard(row, variant)}</div>),
}));
vi.mock("@/features/recipes/components/recipe-card", () => ({
  RecipeCard: ({ variant }: { variant: string }) => void seen.cards.push(variant) ?? null,
}));

const { RecipeResults } = await import("@/features/recipes/components/recipe-results");
const { LibraryCards } = await import("@/features/recipes/components/library-cards");

describe("Search results", () => {
  it("use the list card whatever the Library's view is", () => {
    seen.cards.length = 0;
    render(
      <RecipeResults
        header={<div />}
        isFetchingNextPage={false}
        isLoading={false}
        recipes={[{ id: "a" }] as never}
        scroll={{} as never}
        onEndReached={() => {}}
      />
    );

    expect(seen.cards).toEqual(["list"]);
  });

  it("the Recipes tab's cards still follow the Library's view", () => {
    let shown = "";
    render(
      <LibraryCards
        fadeHeight={0 as never}
        header={<div />}
        isFetchingNextPage={false}
        isLoading={false}
        renderCard={(_, { variant }) => {
          shown = variant;

          return <div />;
        }}
        rowKey={String}
        rows={["a"]}
        scroll={{} as never}
        onEndReached={() => {}}
      />
    );

    expect(shown).toBe("grid");
  });
});

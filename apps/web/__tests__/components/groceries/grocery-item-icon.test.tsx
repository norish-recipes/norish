/**
 * A grocery shows its food's Ingredient Icon, read once for the whole list:
 * a typed one too, once Norish knows its food, and nothing while a grocery
 * added offline waits for the server to resolve it.
 */
import { GroceryItem } from "@/components/groceries/grocery-item";
import { IngredientIconsProvider } from "@/components/ingredients/ingredient-icon";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GroceryDto } from "@norish/shared/contracts";

const ONION = "11111111-1111-4111-8111-111111111111";
const ONION_ICON = "/ingredient-icons/0123456789abcdef0123456789abcdef.webp";

vi.mock("@/context/hidden-items-context", () => ({ useHiddenItems: () => [] }));
vi.mock("@/hooks/use-unit-formatter", () => ({
  useUnitFormatter: () => ({ formatAmountUnit: () => "" }),
}));
vi.mock("@/components/groceries/grocery-price", () => ({ GroceryPrice: () => null }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    ingredients: {
      icons: {
        queryOptions: (input: { ids: string[] }) => ({
          queryKey: ["ingredients.icons", input],
          queryFn: async () => Object.fromEntries(input.ids.map((id) => [id, ONION_ICON])),
        }),
      },
    },
  }),
}));

function grocery(values: Partial<GroceryDto>): GroceryDto {
  return {
    id: crypto.randomUUID(),
    name: "onions",
    amount: null,
    unit: null,
    isDone: false,
    sortOrder: 0,
    version: 1,
    recipeIngredientId: null,
    recurringGroceryId: null,
    storeId: null,
    ...values,
  } as GroceryDto;
}

function onList(groceries: GroceryDto[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <IngredientIconsProvider ids={groceries.map((it) => it.ingredientId)}>
        {groceries.map((it) => (
          <GroceryItem
            key={it.id}
            grocery={it}
            onDelete={vi.fn()}
            onEdit={vi.fn()}
            onToggle={vi.fn()}
          />
        ))}
      </IngredientIconsProvider>
    </QueryClientProvider>
  );
}

describe("GroceryItem", () => {
  it("shows its food's icon, and nothing while the server has yet to resolve its food", async () => {
    onList([grocery({ ingredientId: ONION }), grocery({ name: "added offline" })]);

    expect((await screen.findByTestId("ingredient-icon")).getAttribute("src")).toBe(ONION_ICON);
    expect(screen.getAllByTestId("ingredient-icon")).toHaveLength(1);
    expect(screen.queryByTestId("ingredient-icon-placeholder")).toBeNull();
  });
});

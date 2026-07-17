import type { BrowserContext } from "@playwright/test";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";

import type { AppRouter } from "@norish/trpc";

export const PRIMARY_RECIPE_ID = "11111111-1111-4111-8111-111111111111";
export const PRIMARY_STORE_ID = "22222222-2222-4222-8222-222222222222";
export const PRIMARY_GROCERY_ID = "33333333-3333-4333-8333-333333333333";
export const PRIMARY_CALENDAR_ID = "44444444-4444-4444-8444-444444444444";
export const SECONDARY_RECIPE_ID = "55555555-5555-4555-8555-555555555555";
export const PRIMARY_HOUSEHOLD_ID = "66666666-6666-4666-8666-666666666666";
export const SECONDARY_HOUSEHOLD_ID = "77777777-7777-4777-8777-777777777777";

export const PRIMARY_RECIPE_NAME = "E2E Tomato Soup";
export const SECONDARY_RECIPE_NAME = "E2E Secondary Pantry";
export const PRIMARY_GROCERY_NAME = "E2E Tomatoes";
export const PRIMARY_STORE_NAME = "E2E Market";

export async function createAuthenticatedApi(context: BrowserContext, baseURL: string) {
  const cookies = await context.cookies(baseURL);
  const cookie = cookies.map(({ name, value }) => `${name}=${value}`).join("; ");

  return createTRPCProxyClient<AppRouter>({
    links: [
      httpLink({
        url: `${baseURL}/api/trpc`,
        transformer: superjson,
        headers: () => ({
          cookie,
          "x-operation-id": crypto.randomUUID(),
        }),
      }),
    ],
  });
}

export async function seedPrimaryHousehold(
  api: Awaited<ReturnType<typeof createAuthenticatedApi>>
) {
  await api.recipes.create.mutate({
    id: PRIMARY_RECIPE_ID,
    name: PRIMARY_RECIPE_NAME,
    description: "Seeded through the authenticated tRPC API.",
    systemUsed: "metric",
    recipeIngredients: [],
    steps: [],
    tags: [],
  });
  await api.stores.create.mutate({
    id: PRIMARY_STORE_ID,
    name: PRIMARY_STORE_NAME,
    color: "primary",
    icon: "ShoppingBagIcon",
  });
  await api.groceries.create.mutate([
    {
      id: PRIMARY_GROCERY_ID,
      name: PRIMARY_GROCERY_NAME,
      unit: null,
      amount: 2,
      isDone: false,
      recipeIngredientId: null,
      recurringGroceryId: null,
      storeId: PRIMARY_STORE_ID,
    },
  ]);
  await api.calendar.createItem.mutate({
    id: PRIMARY_CALENDAR_ID,
    date: new Date().toISOString().slice(0, 10),
    slot: "Dinner",
    itemType: "recipe",
    recipeId: PRIMARY_RECIPE_ID,
  });
}

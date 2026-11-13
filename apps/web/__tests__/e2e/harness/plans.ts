import type { SessionCookies } from "./auth";
import { callTrpc, queryTrpc } from "./trpc";

/** A planned item as `calendar.listItems` answers it. */
export interface Plan {
  id: string;
  version: number;
  date: string;
  slot: string;
  recipeId: string | null;
  title: string | null;
}

/**
 * Deletes the household's plans, on any day, that `picks` chooses. Specs share
 * a worker's database, so a test removes the plans it made and clears a slot it asserts on.
 */
export async function removePlans(
  baseURL: string,
  cookies: SessionCookies,
  picks: (plan: Plan) => boolean
): Promise<void> {
  const plans = await queryTrpc<Plan[]>(baseURL, cookies, "calendar.listItems", {
    startISO: "2000-01-01",
    endISO: "2999-12-31",
  });

  for (const plan of plans.filter(picks)) {
    await callTrpc(baseURL, cookies, "calendar.deleteItem", {
      itemId: plan.id,
      version: plan.version,
    });
  }
}

/**
 * Plans the recipe as the reader's dinner today, in the browser's own calendar,
 * alone in its slot: Today's card draws only a slot's first plan.
 */
export async function planForTonight(
  baseURL: string,
  cookies: SessionCookies,
  recipeId: string
): Promise<void> {
  const today = new Date().toLocaleDateString("en-CA");

  await removePlans(baseURL, cookies, (plan) => plan.date === today && plan.slot === "Dinner");
  await callTrpc(baseURL, cookies, "calendar.createItem", {
    date: today,
    slot: "Dinner",
    itemType: "recipe",
    recipeId,
  });
}

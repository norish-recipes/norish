import type { CookbookSummaryDTO } from "@norish/shared/contracts";

import type { AIE2EStack } from "./fixture";
import { userIdOf } from "../harness/accounts";
import { recipeIdsNamed, seedRecipe as seedRecipeFor } from "../harness/recipes";
import { callTrpc, queryTrpc } from "../harness/trpc";
import { OWNER } from "./fixture";

type Owner = Pick<AIE2EStack, "baseURL" | "ownerCookies">;

/** A recipe of the owner's with these amount-less lines, seeded past any AI pass; its id. */
export async function seedRecipe(name: string, lines: readonly string[] = []): Promise<string> {
  return seedRecipeFor(await userIdOf(OWNER), name, lines);
}

/** A cookbook of the owner's holding these recipes, filed as the membership panel files them. */
export async function seedCookbook(
  stack: Owner,
  title: string,
  recipeIds: string[]
): Promise<string> {
  const { id } = await callTrpc<{ id: string }>(
    stack.baseURL,
    stack.ownerCookies,
    "cookbooks.create",
    {
      title,
    }
  );

  for (const recipeId of recipeIds) {
    await callTrpc(stack.baseURL, stack.ownerCookies, "cookbooks.setMembership", {
      cookbookId: id,
      recipeId,
      isMember: true,
    });
  }

  return id;
}

/** Every cookbook, as the owner (a server admin) lists them. */
async function everyCookbook(stack: Owner): Promise<CookbookSummaryDTO[]> {
  const { cookbooks } = await queryTrpc<{ cookbooks: CookbookSummaryDTO[] }>(
    stack.baseURL,
    stack.ownerCookies,
    "cookbooks.list",
    { limit: 200, sortMode: "none" }
  );

  return cookbooks;
}

/** Which recipes a cookbook holds, by title. */
export async function readCookbookMembers(stack: Owner, title: string): Promise<string[]> {
  const cookbook = (await everyCookbook(stack)).find((candidate) => candidate.title === title);

  if (!cookbook) return [];
  const { recipes } = await queryTrpc<{ recipes: Array<{ name: string }> }>(
    stack.baseURL,
    stack.ownerCookies,
    "cookbooks.recipes",
    { cookbookId: cookbook.id }
  );

  return recipes.map((recipe) => recipe.name).sort((a, b) => a.localeCompare(b));
}

/** A cookbook's uploaded cover URL, by title, or null when it has none. */
export async function readCookbookImage(stack: Owner, title: string): Promise<string | null> {
  return (await everyCookbook(stack)).find((cookbook) => cookbook.title === title)?.image ?? null;
}

/** Every stored cookbook title. */
export async function readCookbookTitles(stack: Owner): Promise<string[]> {
  return (await everyCookbook(stack)).map((cookbook) => cookbook.title);
}

/** Whether a recipe row still exists, by name. */
export async function recipeExists(name: string): Promise<boolean> {
  return (await recipeIdsNamed(name)).length > 0;
}

/** Drop the cookbooks of this title, so a scenario that made its own can clean up after it. */
export async function deleteCookbookByTitle(stack: Owner, title: string): Promise<void> {
  for (const cookbook of await everyCookbook(stack)) {
    if (cookbook.title === title) await deleteCookbook(stack, cookbook);
  }
}

/** Clear every cookbook, so each scenario starts from a known Library. */
export async function clearCookbooks(stack: Owner): Promise<void> {
  for (const cookbook of await everyCookbook(stack)) await deleteCookbook(stack, cookbook);
}

async function deleteCookbook(stack: Owner, cookbook: CookbookSummaryDTO): Promise<void> {
  await callTrpc(stack.baseURL, stack.ownerCookies, "cookbooks.remove", {
    id: cookbook.id,
    version: cookbook.version,
  });
}

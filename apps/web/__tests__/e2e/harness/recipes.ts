import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";

import type { LineResolution } from "@norish/db/repositories/ingredients";
import type { RecipeListContext } from "@norish/db/repositories/recipes";
import type { FullRecipeDTO, FullRecipeInsertDTO } from "@norish/shared/contracts";
import { createRecipeWithRefs, searchRecipesByName } from "@norish/db/repositories/recipes";
import { lineNamesNoFood } from "@norish/shared/lib/ingredient-text";

import type { SessionCookies } from "./auth";
import { mintFood } from "./foods";
import { callTrpc, queryTrpc, TrpcHttpError } from "./trpc";

/** A server admin's view: every recipe and cookbook, whoever owns it. */
export const ADMIN_VIEW: RecipeListContext = {
  userId: "",
  householdUserIds: null,
  isServerAdmin: true,
};

/**
 * A recipe with these amount-less lines, saved through tRPC as the recipe form
 * saves one; `extra` overrides any field of the form's payload. Answers its id.
 */
export function createRecipe(
  baseURL: string,
  cookies: SessionCookies,
  name: string,
  lines: readonly string[],
  extra: Record<string, unknown> = {}
): Promise<string> {
  return callTrpc<string>(baseURL, cookies, "recipes.create", {
    name,
    systemUsed: "metric",
    servings: 2,
    recipeIngredients: lines.map((ingredientName, order) => ({
      ingredientName,
      ingredientId: null,
      amount: null,
      unit: null,
      order,
    })),
    steps: [],
    tags: [],
    cuisines: [],
    categories: [],
    images: [],
    videos: [],
    ...extra,
  });
}

/** The ids of every stored recipe named exactly this, whoever owns it. */
export async function recipeIdsNamed(name: string): Promise<string[]> {
  const found = await searchRecipesByName(ADMIN_VIEW, name, 100);

  return found.filter((recipe) => recipe.name === name).map((recipe) => recipe.id);
}

/** The id of the stored recipe named exactly this; fails when there is none. */
export async function recipeIdNamed(name: string): Promise<string> {
  const [id] = await recipeIdsNamed(name);

  if (!id) throw new Error(`No recipe is named ${name}`);

  return id;
}

/**
 * A recipe written through the repositories, past the resolver and any AI pass: each line an
 * amount-less food by name, minted where new (a heading names none). Answers its id.
 */
export async function seedRecipe(
  userId: string,
  name: string,
  lines: readonly string[] = [],
  extra: Partial<FullRecipeInsertDTO> & { id?: string } = {}
): Promise<string> {
  const { id = randomUUID(), ...payload } = extra;
  const resolutions = new Map<string, LineResolution | null>();

  for (const line of lines) {
    if (!lineNamesNoFood({ text: line, amount: null })) {
      resolutions.set(line, { foods: [await mintFood(line)], joined: null });
    }
  }

  await createRecipeWithRefs(id, userId, {
    name,
    servings: 2,
    systemUsed: "metric",
    recipeIngredients: lines.map((ingredientName, order) => ({
      ingredientName,
      ingredientId: null,
      amount: null,
      unit: null,
      order,
    })),
    ...payload,
    ingredientResolutions: resolutions,
  });

  return id;
}

/** The recipe as the reader the cookies sign in sees it; null while it is not there. */
export async function readRecipe(
  baseURL: string,
  cookies: SessionCookies,
  id: string
): Promise<FullRecipeDTO | null> {
  try {
    return await queryTrpc<FullRecipeDTO>(baseURL, cookies, "recipes.get", { id });
  } catch (error) {
    if (error instanceof TrpcHttpError && error.status === 404) return null;
    throw error;
  }
}

/** The recipe named exactly this as the reader sees it; null for none. */
export async function recipeNamed(
  baseURL: string,
  cookies: SessionCookies,
  name: string
): Promise<FullRecipeDTO | null> {
  const [id] = await recipeIdsNamed(name);

  return id ? await readRecipe(baseURL, cookies, id) : null;
}

/** Wait until the recipe a create answered for is stored and `ready`: a mutation answers first. */
export async function waitForRecipe(
  baseURL: string,
  cookies: SessionCookies,
  id: string,
  ready: (recipe: FullRecipeDTO) => boolean = () => true
): Promise<FullRecipeDTO> {
  let recipe: FullRecipeDTO | null = null;

  await expect
    .poll(
      async () => {
        recipe = await readRecipe(baseURL, cookies, id);

        return recipe !== null && ready(recipe);
      },
      { timeout: 30_000 }
    )
    .toBe(true);

  return recipe!;
}

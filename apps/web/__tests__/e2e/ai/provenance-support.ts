import type { FullRecipeDTO } from "@norish/shared/contracts";

import type { AIE2EStack } from "./fixture";
import { readRecipe, recipeIdNamed, waitForRecipe } from "../harness/recipes";
import { callTrpc } from "../harness/trpc";

type Owner = Pick<AIE2EStack, "baseURL" | "ownerCookies">;

/** A seeded Cuisine's id, from the vocabulary an editor picks from. */
export async function findCuisineIdByName(stack: Owner, name: string): Promise<string> {
  const { cuisines } = await callTrpc<{ cuisines: Array<{ id: string; name: string }> }>(
    stack.baseURL,
    stack.ownerCookies,
    "config.cuisines"
  );
  const cuisine = cuisines.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());

  if (!cuisine) throw new Error(`Seeded Cuisine missing: ${name}`);

  return cuisine.id;
}

async function storedRecipe(stack: Owner, name: string): Promise<FullRecipeDTO> {
  const recipe = await readRecipe(stack.baseURL, stack.ownerCookies, await recipeIdNamed(name));

  if (!recipe) throw new Error(`Recipe not found: ${name}`);

  return recipe;
}

export async function readStoredProvenance(
  stack: Owner,
  recipeName: string
): Promise<{
  originCountry: string | null;
  originCountryName: string | null;
  originRegion: string | null;
  provenanceNote: string | null;
  cuisines: string[];
}> {
  const recipe = await storedRecipe(stack, recipeName);

  return {
    originCountry: recipe.originCountry ?? null,
    originCountryName: recipe.originCountryName ?? null,
    originRegion: recipe.originRegion ?? null,
    provenanceNote: recipe.provenanceNote ?? null,
    cuisines: recipe.cuisines.map((cuisine) => cuisine.name),
  };
}

/** Supply a provenance group as an editor saves one: the given slots, the rest blank. */
export async function supplyProvenance(
  stack: Owner,
  recipeName: string,
  provenance: { originCountry?: string; provenanceNote?: string; cuisineIds?: string[] }
): Promise<void> {
  const recipe = await storedRecipe(stack, recipeName);

  await callTrpc(stack.baseURL, stack.ownerCookies, "recipes.update", {
    id: recipe.id,
    version: recipe.version,
    data: {
      originCountry: provenance.originCountry ?? null,
      originCountryName: null,
      originRegion: null,
      provenanceNote: provenance.provenanceNote ?? null,
      cuisines: provenance.cuisineIds ?? [],
    },
  });
  // The save lands after the mutation answers.
  await waitForRecipe(stack.baseURL, stack.ownerCookies, recipe.id, (saved) => {
    return saved.version > recipe.version;
  });
}

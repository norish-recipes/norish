import type { Page } from "@playwright/test";

import type { AIConfig } from "@norish/config/zod/server-config";

import type { AIE2EStack, SessionCookies } from "./fixture";
import { recipeNamed } from "../harness/recipes";
import { callTrpc, submitMutation } from "../harness/trpc";

/** The owner's way into the app, which every admin-only setting here goes through. */
export type OwnerApi = Pick<AIE2EStack, "baseURL" | "ownerCookies">;

/**
 * Ask for a manual enrichment run from the recipe's Actions menu, and do not
 * return until the request has landed.
 *
 * Every kind reaches the server through the same `recipes.requestEnrichment`
 * mutation, and every caller here navigates immediately afterwards — a reload
 * inside a polling assertion, or the next scenario. Without the wait that
 * navigation can abort the request before it is issued, and the run this
 * scenario asked for simply never happens.
 */
export async function requestEnrichment(page: Page, action: string): Promise<void> {
  await page.getByRole("button", { name: "Actions" }).click();
  await submitMutation(page, "recipes.requestEnrichment", () =>
    page.getByRole("menuitem", { name: action }).click()
  );
}

export async function setAutomaticEnrichment(
  stack: OwnerApi,
  switches: Partial<
    Record<
      | "autoTagging"
      | "allergyDetection"
      | "autoCategorization"
      | "nutritionEstimation"
      | "recipeProvenance"
      | "ingredientLinking"
      | "imageGeneration",
      boolean
    >
  >
): Promise<void> {
  await updateAIConfig(stack, {
    automaticEnrichment: {
      autoTagging: false,
      allergyDetection: false,
      autoCategorization: false,
      nutritionEstimation: false,
      recipeProvenance: false,
      ingredientLinking: false,
      imageGeneration: false,
      ...switches,
    },
  });
}

/** Change fields of the AI configuration through the admin settings, keeping the rest. */
export async function updateAIConfig(stack: OwnerApi, change: Partial<AIConfig>): Promise<void> {
  const { ai_config: stored } = await callTrpc<{ ai_config?: AIConfig | null }>(
    stack.baseURL,
    stack.ownerCookies,
    "admin.getAllConfigs"
  );

  if (!stored) throw new Error("The AI configuration is missing");
  await callTrpc(stack.baseURL, stack.ownerCookies, "admin.updateAIConfig", {
    ...stored,
    ...change,
  });
}

export async function readStoredCategories(stack: OwnerApi, recipeName: string): Promise<string[]> {
  const recipe = await recipeNamed(stack.baseURL, stack.ownerCookies, recipeName);

  if (!recipe) throw new Error(`Recipe not found: ${recipeName}`);

  return recipe.categories;
}

export async function supplyUserAllergies(
  baseURL: string,
  cookies: SessionCookies,
  allergies: string[]
): Promise<void> {
  const { version } = await callTrpc<{ version: number }>(baseURL, cookies, "user.getAllergies");

  await callTrpc(baseURL, cookies, "user.setAllergies", { allergies, version });
}

// @vitest-environment node
/**
 * Recipe Provenance repository tests.
 *
 * Verifies the migration defaults (existing recipes carry no fabricated
 * provenance) and that updateRecipeProvenance persists every value atomically
 * and is re-runnable.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getRecipeFull, updateRecipeProvenance } from "@norish/db/repositories/recipes";

import { createTestRecipe } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("Recipe Provenance repository", () => {
  const testBase = new RepositoryTestBase("test_provenance");
  let userId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    userId = user.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("defaults to no provenance for a freshly created recipe", async () => {
    const recipe = await createTestRecipe(userId, { name: "Plain Recipe" });

    const loaded = await getRecipeFull(recipe.id);

    expect(loaded?.originCountryCode).toBeNull();
    expect(loaded?.region).toBeNull();
    expect(loaded?.cuisines).toEqual([]);
    expect(loaded?.provenanceNote).toBeNull();
  });

  it("persists all provenance values atomically and bumps the version", async () => {
    const recipe = await createTestRecipe(userId, { name: "Lasagne" });
    const before = await getRecipeFull(recipe.id);

    const outcome = await updateRecipeProvenance(recipe.id, {
      originCountryCode: "IT",
      region: "Emilia-Romagna",
      cuisines: ["Italian", "Emilian"],
      note: "A classic baked pasta dish.",
    });

    expect(outcome.applied).toBe(true);

    const after = await getRecipeFull(recipe.id);

    expect(after?.originCountryCode).toBe("IT");
    expect(after?.region).toBe("Emilia-Romagna");
    expect(after?.cuisines).toEqual(["Italian", "Emilian"]);
    expect(after?.provenanceNote).toBe("A classic baked pasta dish.");
    expect(after?.version).toBe((before?.version ?? 0) + 1);
  });

  it("replaces prior provenance on re-inference, including clearing the country", async () => {
    const recipe = await createTestRecipe(userId, { name: "Fusion Bowl" });

    await updateRecipeProvenance(recipe.id, {
      originCountryCode: "JP",
      region: "Kansai",
      cuisines: ["Japanese"],
      note: "First guess.",
    });

    await updateRecipeProvenance(recipe.id, {
      originCountryCode: null,
      region: null,
      cuisines: ["Fusion"],
      note: "Origin uncertain.",
    });

    const after = await getRecipeFull(recipe.id);

    expect(after?.originCountryCode).toBeNull();
    expect(after?.region).toBeNull();
    expect(after?.cuisines).toEqual(["Fusion"]);
    expect(after?.provenanceNote).toBe("Origin uncertain.");
  });
});

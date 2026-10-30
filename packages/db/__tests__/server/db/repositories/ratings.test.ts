// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { FullRecipeDTO, User } from "@norish/shared/contracts";
import { getUserRating, rateRecipe, removeRating } from "@norish/db/repositories/ratings";

import { createTestUser } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("removeRating", () => {
  const testBase = new RepositoryTestBase("test_ratings");
  let user: User;
  let recipe: FullRecipeDTO;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    [user, recipe] = await testBase.beforeEachTest();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("takes back one user's rating and leaves another's", async () => {
    const other = await createTestUser();

    await rateRecipe(user.id, recipe.id, 4);
    await rateRecipe(other.id, recipe.id, 2);

    await removeRating(user.id, recipe.id);

    expect(await getUserRating(user.id, recipe.id)).toBeNull();
    expect(await getUserRating(other.id, recipe.id)).toBe(2);
  });

  it("is a no-op when there is no rating", async () => {
    await expect(removeRating(user.id, recipe.id)).resolves.toBe(false);
  });

  it("leaves a rating that changed since the version the caller saw", async () => {
    await rateRecipe(user.id, recipe.id, 4);
    await rateRecipe(user.id, recipe.id, 5, 1);

    await expect(rateRecipe(user.id, recipe.id, null, 1)).resolves.toMatchObject({ stale: true });
    expect(await getUserRating(user.id, recipe.id)).toBe(5);

    await rateRecipe(user.id, recipe.id, null, 2);
    expect(await getUserRating(user.id, recipe.id)).toBeNull();
  });
});

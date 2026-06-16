// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@norish/db/drizzle";
import {
  attachTagsToRecipeByInputTx,
  getRecipeTagNames,
  listAllTagNames,
} from "@norish/db/repositories/tags";

import { createTestRecipe, createTestUser } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const testBase = new RepositoryTestBase("test_tags");
let testRecipe: Awaited<ReturnType<typeof createTestRecipe>>;

describe("Tags Repository", () => {
  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [, recipe] = await testBase.beforeEachTest();
    testRecipe = recipe;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("removes unused tags and keeps the new casing when recreating them", async () => {
    await db.transaction(async (tx) => {
      await attachTagsToRecipeByInputTx(tx, testRecipe.id, ["JavaScript"]);
    });

    expect(await getRecipeTagNames(testRecipe.id)).toEqual(["JavaScript"]);
    expect(await listAllTagNames()).toContain("JavaScript");

    await db.transaction(async (tx) => {
      await attachTagsToRecipeByInputTx(tx, testRecipe.id, []);
    });

    expect(await getRecipeTagNames(testRecipe.id)).toEqual([]);
    expect(await listAllTagNames()).not.toContain("JavaScript");

    await db.transaction(async (tx) => {
      await attachTagsToRecipeByInputTx(tx, testRecipe.id, ["javascript"]);
    });

    expect(await getRecipeTagNames(testRecipe.id)).toEqual(["javascript"]);
  });

  it("keeps tags that are still used by another recipe", async () => {
    const user = await createTestUser();
    const secondRecipe = await createTestRecipe(user.id, { name: "Recipe 2" });

    await db.transaction(async (tx) => {
      await attachTagsToRecipeByInputTx(tx, testRecipe.id, ["Python"]);
      await attachTagsToRecipeByInputTx(tx, secondRecipe.id, ["Python"]);
      await attachTagsToRecipeByInputTx(tx, testRecipe.id, []);
    });

    expect(await listAllTagNames()).toContain("Python");
    expect(await getRecipeTagNames(secondRecipe.id)).toEqual(["Python"]);
  });
});

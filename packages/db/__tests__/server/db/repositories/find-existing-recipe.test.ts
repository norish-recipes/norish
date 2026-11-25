// @vitest-environment node
/**
 * How an archive import finds the recipe an entry overwrites (ADR-0022): by
 * URL first, then by name, and a name never crosses two different URLs nor
 * reaches a recipe the import already wrote.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { findExistingRecipe } from "@norish/db/repositories/recipes";

import { createTestRecipe, testHouseholdOf } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("findExistingRecipe", () => {
  const testBase = new RepositoryTestBase("test_find_existing_recipe");
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

  it("matches by URL first", async () => {
    const recipe = await createTestRecipe(userId, {
      name: "Pollo al curry",
      url: "https://a.example/curry",
    });

    expect(
      await findExistingRecipe(testHouseholdOf(userId), "https://a.example/curry", "Something else")
    ).toBe(recipe.id);
  });

  it("never matches a name across two different URLs", async () => {
    await createTestRecipe(userId, { name: "Pollo al curry", url: "https://a.example/curry" });

    expect(
      await findExistingRecipe(testHouseholdOf(userId), "https://b.example/curry", "pollo al curry")
    ).toBe(null);
  });

  it("matches a name where either recipe has no URL", async () => {
    const stored = await createTestRecipe(userId, { name: "Tiramisù", url: null });
    const withUrl = await createTestRecipe(userId, {
      name: "Panettone",
      url: "https://a.example/panettone",
    });

    expect(
      await findExistingRecipe(testHouseholdOf(userId), "https://b.example/t", "tiramisù")
    ).toBe(stored.id);
    expect(await findExistingRecipe(testHouseholdOf(userId), undefined, "Panettone")).toBe(
      withUrl.id
    );
  });

  it("finds a same-named recipe the import has not written yet, past one it has", async () => {
    const written = await createTestRecipe(userId, { name: "Quiche", url: null });
    const other = await createTestRecipe(userId, { name: "Quiche", url: null });

    expect(
      await findExistingRecipe(testHouseholdOf(userId), undefined, "Quiche", [written.id])
    ).toBe(other.id);
    expect(
      await findExistingRecipe(testHouseholdOf(userId), undefined, "Quiche", [written.id, other.id])
    ).toBe(null);
  });

  it("still matches a recipe the import wrote by its URL", async () => {
    const written = await createTestRecipe(userId, {
      name: "Quiche",
      url: "https://a.example/quiche",
    });

    expect(
      await findExistingRecipe(testHouseholdOf(userId), "https://a.example/quiche", "Quiche", [
        written.id,
      ])
    ).toBe(written.id);
  });
});

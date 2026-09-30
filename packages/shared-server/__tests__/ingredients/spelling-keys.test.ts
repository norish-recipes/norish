// @vitest-environment node
/**
 * Online, against a real database: the resolver decides the spelling cases
 * the clients decide offline (`packages/shared`'s `spelling-keys.test.ts`),
 * and decides them the same way.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { findIngredientFor, resolveIngredient } from "@norish/shared-server/ingredients/resolver";

import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";
import { SPELLING_CASES } from "../../../shared/__tests__/lib/spelling-cases";

describe("spelling keys, online", () => {
  const testBase = new RepositoryTestBase("test_spelling_keys");
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

  it.each(SPELLING_CASES)("a Pantry %j covers a line %j: %s", async (pantry, line, covered) => {
    const held = await resolveIngredient(pantry, { userId }, { ai: false });
    const found = await findIngredientFor(line);

    expect(found?.ingredientId === held!.ingredientId).toBe(covered);
  });
});

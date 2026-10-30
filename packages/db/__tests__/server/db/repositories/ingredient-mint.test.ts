// @vitest-environment node
/**
 * A mint of a name that is already an Ingredient's joins that one; only a row
 * with no spelling at all, from before the upgrade, is taken over (ADR-0037).
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { mintIngredientWithAliases } from "@norish/db/repositories/ingredient-aliases";
import * as schema from "@norish/db/schema";

import { createTestIngredient, getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("mintIngredientWithAliases on a name already taken", () => {
  const testBase = new RepositoryTestBase("test_ingredient_mint");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const mintRedOnion = () =>
    mintIngredientWithAliases({
      name: "red onion",
      aliases: [{ text: "red onions", fold: "red onions" }],
      ownerId: null,
      locale: null,
      flagged: true,
      flagReason: "upgrade",
    });

  const read = async (id: string) =>
    (await getTestDb().select().from(schema.ingredients).where(eq(schema.ingredients.id, id)))[0]!;

  it("leaves a spelled Ingredient's parent and flag alone", async () => {
    const onion = await createTestIngredient({ name: "onion" });
    const redOnion = await createTestIngredient({ name: "red onion" });

    await getTestDb()
      .update(schema.ingredients)
      .set({ parentId: onion!.id })
      .where(eq(schema.ingredients.id, redOnion!.id));

    const aliases = await mintRedOnion();

    expect(aliases.map((alias) => alias.ingredientId)).toEqual([redOnion!.id]);
    expect(await read(redOnion!.id)).toMatchObject({ parentId: onion!.id, flagged: false });
  });

  it("takes over an Ingredient with no spelling", async () => {
    const [bare] = await getTestDb()
      .insert(schema.ingredients)
      .values({ name: "red onion" })
      .returning();

    await mintRedOnion();

    expect(await read(bare!.id)).toMatchObject({ flagged: true, flagReason: "upgrade" });
  });
});

// @vitest-environment node
/**
 * A mint of a name that is already an Ingredient's joins that one; only a row
 * with no spelling at all, from before the upgrade, is taken over (ADR-0037).
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { mintIngredientWithAliases } from "@norish/db/repositories/ingredient-aliases";
import { lockIngredients } from "@norish/db/repositories/ingredient-relocation";
import * as schema from "@norish/db/schema";

import { createTestIngredient, getTestDb, testHouseholdOf } from "../../../helpers/db-test-helpers";
import { lockWaits, raceBehind, waitFor } from "../../../helpers/lock-race";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("mintIngredientWithAliases on a name already taken", () => {
  const testBase = new RepositoryTestBase("test_ingredient_mint");

  beforeAll(async () => {
    await testBase.setup();
  });

  let householdId: string;

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    householdId = testHouseholdOf(user.id);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const mintRedOnion = () =>
    mintIngredientWithAliases({
      householdId,
      name: "red onion",
      aliases: [{ text: "red onions", fold: "red onions" }],
      ownerId: null,
      locale: null,
      flagged: true,
      flagReason: "upgrade",
    });

  const read = async (id: string) =>
    (await getTestDb().select().from(schema.ingredients).where(eq(schema.ingredients.id, id)))[0]!;

  it("joins a seeded food of the name as the household's spelling, its parent and flag alone", async () => {
    const onion = await createTestIngredient({ name: "onion" });
    const redOnion = await createTestIngredient({ name: "red onion" });

    await getTestDb()
      .update(schema.ingredients)
      .set({ parentId: onion!.id })
      .where(eq(schema.ingredients.id, redOnion!.id));

    const { aliases, created } = await mintRedOnion();

    expect(aliases.map((alias) => alias.ingredientId)).toEqual([redOnion!.id]);
    expect(created).toBe(false);
    expect(await read(redOnion!.id)).toMatchObject({ parentId: onion!.id, flagged: false });
  });

  it("takes over an Ingredient with no spelling", async () => {
    const [bare] = await getTestDb()
      .insert(schema.ingredients)
      .values({ name: "red onion", householdId })
      .returning();

    await expect(mintRedOnion()).resolves.toMatchObject({ created: false });
    expect(await read(bare!.id)).toMatchObject({ flagged: true, flagReason: "upgrade" });
  });

  it("waits out a delete of the food it joins, then mints its own", async () => {
    const [food] = await getTestDb()
      .insert(schema.ingredients)
      .values({ name: "red onion", householdId })
      .returning();

    await getTestDb()
      .insert(schema.ingredientAliases)
      .values({ householdId, text: "red onion", fold: "red onion", ingredientId: food!.id });

    const [minted] = await raceBehind(
      (tx) => tx.delete(schema.ingredients).where(eq(schema.ingredients.id, food!.id)),
      [mintRedOnion]
    );

    expect(minted).toMatchObject({ status: "fulfilled" });
    const { aliases, created } = (
      minted as PromiseFulfilledResult<Awaited<ReturnType<typeof mintRedOnion>>>
    ).value;
    const [alias] = aliases;

    expect(created).toBe(true);

    expect(alias!.ingredientId).not.toBe(food!.id);
    expect(await read(alias!.ingredientId)).toMatchObject({ name: "red onion", householdId });
  });

  it("locks the food it joins and the parent in id order, as an edit does, so the two never deadlock", async () => {
    const [low, high] = [
      await createTestIngredient({ name: "red onion" }),
      await createTestIngredient({ name: "onion" }),
    ].sort((a, b) => a!.id.localeCompare(b!.id));
    let mint: ReturnType<typeof mintIngredientWithAliases> | undefined;

    // An edit over both foods, holding the lower: the mint waits there, holding nothing the edit wants.
    await getTestDb().transaction(async (tx) => {
      await lockIngredients(tx, [low!.id]);
      mint = mintIngredientWithAliases({
        householdId,
        name: low!.name,
        aliases: [{ text: low!.name, fold: low!.name }],
        ownerId: null,
        locale: null,
        flagged: false,
        parentId: high!.id,
      });
      mint.catch(() => undefined);
      await waitFor(async () => ((await lockWaits()).size > 0 ? true : undefined), "the mint");
      await lockIngredients(tx, [high!.id]);
    });

    await expect(mint).resolves.toMatchObject({ created: false });
  });
});

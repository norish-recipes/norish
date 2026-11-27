// @vitest-environment node
/** "We keep this" on another household's recipe line (ADR-0042): the Pantry row names the reader's
 * food and spelling, never the author's, even when the client sends the author's. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@norish/shared/contracts";

import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

vi.mock("@norish/shared-server/realtime/pantry", () => import("../mocks/realtime/pantry"));

describe("the Pantry kept from another household's recipe line", () => {
  const testBase = new RepositoryTestBase("test_pantry_read_through");
  let helpers: typeof import("../../../db/__tests__/helpers/db-test-helpers");
  let router: typeof import("../../src/routers/pantry").pantryRouter;
  let households: typeof import("@norish/db/repositories/households");
  let author: User;
  let reader: User;

  beforeAll(async () => {
    await testBase.setup();
    helpers = await import("../../../db/__tests__/helpers/db-test-helpers");
    router = (await import("../../src/routers/pantry")).pantryRouter;
    households = await import("@norish/db/repositories/households");
  });

  beforeEach(async () => {
    const [stored] = await testBase.beforeEachTest();

    author = { ...stored, isServerAdmin: false } as User;
    reader = { ...(await helpers.createTestUser()), isServerAdmin: false } as User;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function as(user: User) {
    const household = await households.getHouseholdForUser(user.id);

    return router.createCaller({
      user,
      household: household && {
        id: household.id,
        name: household.name,
        users: household.users.map(({ id, name }) => ({ id, name: name ?? "" })),
      },
      connectionId: null,
      operationId: null,
    } as never);
  }

  it("names the reader's food and spelling", async () => {
    const readerHousehold = helpers.testHouseholdOf(reader.id);
    const theirs = await helpers.mintTestFood(helpers.testHouseholdOf(author.id), "ui");
    const mine = await helpers.mintTestFood(readerHousehold, "ui");
    const line = await helpers.nameInATestRecipe(author.id, theirs.aliasId, "ui");

    await (
      await as(reader)
    ).add({
      id: crypto.randomUUID(),
      ingredientId: theirs.ingredientId,
      recipeIngredientId: line.id,
    });

    const [row] = await helpers.testPantrySpellings(reader.id);

    expect(row).toMatchObject({ ingredientId: mine.ingredientId, ingredientAliasId: mine.aliasId });
    expect((await helpers.readTestIngredient(row!.ingredientId))?.householdId).toBe(
      readerHousehold
    );
    expect((await helpers.readTestSpelling(row!.ingredientAliasId!))?.householdId).toBe(
      readerHousehold
    );
    // Without the line, another household's food is not found.
    await expect(
      (await as(reader)).add({ id: crypto.randomUUID(), ingredientId: theirs.ingredientId })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

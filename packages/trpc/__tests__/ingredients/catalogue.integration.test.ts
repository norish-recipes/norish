// @vitest-environment node
/**
 * The Ingredients procedures with the real guard and repositories, in two households (ADR-0042):
 * any member edits the household's foods, a food added by hand is the household's, and another
 * household reads, counts and changes none of them by id. A seeded food is the admins'.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@norish/shared/contracts";

import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

vi.mock(
  "@norish/shared-server/realtime/ingredients",
  () => import("../mocks/realtime/ingredients")
);

describe("the Ingredients procedures in two households", () => {
  const testBase = new RepositoryTestBase("test_ingredients_routers");
  let helpers: typeof import("../../../db/__tests__/helpers/db-test-helpers");
  let router: typeof import("../../src/routers/ingredients").ingredientsRouter;
  let households: typeof import("@norish/db/repositories/households");
  let seed: typeof import("@norish/db/repositories/ingredient-seed");
  let realtime: typeof import("../mocks/realtime/ingredients").ingredients;
  let admin: User;
  let housemate: User;
  let stranger: User;

  beforeAll(async () => {
    await testBase.setup();
    helpers = await import("../../../db/__tests__/helpers/db-test-helpers");
    router = (await import("../../src/routers/ingredients")).ingredientsRouter;
    households = await import("@norish/db/repositories/households");
    seed = await import("@norish/db/repositories/ingredient-seed");
    realtime = (await import("../mocks/realtime/ingredients")).ingredients;
  });

  beforeEach(async () => {
    const [stored] = await testBase.beforeEachTest();
    const asUser = (row: { id: string; name: string | null }, isServerAdmin = false) =>
      ({ ...row, isServerAdmin }) as User;

    admin = asUser(stored, true);
    housemate = asUser(await helpers.createTestUser());
    stranger = asUser(await helpers.createTestUser(), true);
    await helpers.joinTestHousehold(housemate.id, admin.id);
    realtime.reset();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  /** The context the HTTP path builds: the account and the household read for this request. */
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

  it("adds a food by hand for the household, which a housemate edits and another household never sees", async () => {
    const mine = await as(housemate);
    const added = await mine.add({ name: "sterrenmix", spellings: ["starmix"] });

    expect(added).toMatchObject({
      created: true,
      ingredient: { name: "sterrenmix", canEdit: true },
    });
    const id = added.ingredient!.id;

    expect(realtime.published).toEqual([
      expect.objectContaining({
        event: "changed",
        payload: { ingredientIds: [id] },
        target: { viewPolicy: "household", householdId: helpers.testHouseholdOf(admin.id) },
      }),
    ]);
    await expect(
      (await as(admin)).rename({ ingredientId: id, name: "Sterren mix" })
    ).resolves.toEqual({ success: true });
    await expect(mine.add({ name: "STERREN MIX" })).resolves.toMatchObject({
      created: false,
      ingredient: { id },
    });

    const theirs = await as(stranger);

    await expect(theirs.get({ ingredientId: id })).resolves.toBeNull();
    await expect(theirs.spellings({ ingredientId: id })).resolves.toEqual([]);
    await expect(theirs.uses({ ingredientId: id })).rejects.toThrow("not-found");
    await expect(theirs.names({ ids: [id] })).resolves.toEqual({});
    await expect(theirs.icons({ ids: [id] })).resolves.toEqual({});
    await expect(theirs.nutritionFor({ ingredientIds: [id] })).resolves.toEqual({});
    await expect(theirs.find({ name: "starmix" })).resolves.toBeNull();
    await expect(theirs.list({ search: "sterren" })).resolves.toMatchObject({ items: [] });
    for (const edit of [
      () => theirs.rename({ ingredientId: id, name: "Mine now" }),
      () => theirs.markDistinct({ ingredientId: id }),
      () => theirs.remove({ ingredientId: id }),
      () => theirs.addAlias({ ingredientId: id, text: "sterretjes" }),
      () => theirs.setParent({ ingredientId: id, parentId: null }),
    ]) {
      await expect(edit()).rejects.toThrow("not-found");
    }
    await expect((await as(admin)).find({ name: "starmix" })).resolves.toEqual({
      ingredientId: id,
    });
  });

  it("leaves a seeded food to admins, and a member's spelling on it to their household", async () => {
    const onion = await seed.insertSeededIngredient({ name: "onion", offId: "en:onion" }, [
      { text: "onion", fold: "onion", locale: "en" },
    ]);
    const mine = await as(housemate);

    await expect(mine.rename({ ingredientId: onion, name: "Onions" })).rejects.toThrow("forbidden");
    await mine.addAlias({ ingredientId: onion, text: "uitje" });

    expect(
      (await (await as(admin)).spellings({ ingredientId: onion })).map((one) => one.text)
    ).toEqual(["onion", "uitje"]);
    expect(
      (await (await as(stranger)).spellings({ ingredientId: onion })).map((one) => one.text)
    ).toEqual(["onion"]);
    await expect((await as(admin)).find({ name: "uitje" })).resolves.toEqual({
      ingredientId: onion,
    });
    await expect((await as(stranger)).find({ name: "uitje" })).resolves.toBeNull();
    await expect(
      (await as(stranger)).rename({ ingredientId: onion, name: "Onions" })
    ).resolves.toEqual({
      success: true,
    });
  });
});

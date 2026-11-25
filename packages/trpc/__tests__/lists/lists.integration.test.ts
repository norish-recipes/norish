// @vitest-environment node
/**
 * The household lists through their router with the real repositories (ADR-0043): a member
 * changes the household's entries, an admin the instance's Cuisines, nobody the built-in
 * Categories, and another household nothing; an editable recipe's list is its household's.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@norish/shared/contracts";
import type { listsRealtime } from "@norish/shared/contracts/realtime/lists";

import type { FakeRealtimeDomain } from "../mocks/realtime";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

vi.mock("@norish/shared-server/realtime/lists", () => import("../mocks/realtime/lists"));
vi.mock("@norish/shared-server/realtime/config", () => import("../mocks/realtime/config"));

describe("the lists router", () => {
  const testBase = new RepositoryTestBase("test_lists_router");
  let helpers: typeof import("../../../db/__tests__/helpers/db-test-helpers");
  let listsRouter: typeof import("../../src/routers/lists").listsRouter;
  let households: typeof import("@norish/db/repositories/households");
  let serverConfig: typeof import("@norish/db/repositories/server-config");
  let realtime: FakeRealtimeDomain<typeof listsRealtime>;
  let member: User;
  let housemate: User;
  let admin: User;

  beforeAll(async () => {
    await testBase.setup();
    helpers = await import("../../../db/__tests__/helpers/db-test-helpers");
    ({ listsRouter } = await import("../../src/routers/lists"));
    households = await import("@norish/db/repositories/households");
    serverConfig = await import("@norish/db/repositories/server-config");
    realtime = (await import("@norish/shared-server/realtime/lists")).lists as FakeRealtimeDomain<
      typeof listsRealtime
    >;
  });

  beforeEach(async () => {
    const [stored] = await testBase.beforeEachTest();
    const asUser = (row: { id: string; name: string | null }, isServerAdmin = false) =>
      ({ ...row, isServerAdmin }) as User;

    member = asUser(stored);
    housemate = asUser(await helpers.createTestUser());
    admin = asUser(await helpers.createTestUser(), true);
    await helpers.joinTestHousehold(housemate.id, member.id);
    await serverConfig.deleteConfig("recipe_permission_policy");
    realtime.reset();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function as(user: User) {
    const household = await households.getHouseholdForUser(user.id);

    return listsRouter.createCaller({
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

  it("lets every member add, rename, merge and delete the household's entries", async () => {
    const mine = await as(member);
    const theirs = await as(housemate);
    const { entry: soja, created } = await mine.add({ kind: "tag", name: "soja" });
    const { entry: soy } = await theirs.add({ kind: "tag", name: "Soy" });

    expect(created).toBe(true);
    expect(await theirs.add({ kind: "tag", name: "SOJA" })).toEqual({
      created: false,
      entry: soja,
    });
    expect(await theirs.list({ kind: "tag" })).toEqual([
      { ...soja, recipeCount: 0, editable: true },
      { ...soy, recipeCount: 0, editable: true },
    ]);
    const renamed = await theirs.rename({ kind: "tag", id: soja.id, version: 1, name: "Soja" });

    expect(renamed).toMatchObject({ stale: false, merged: false, entry: { name: "Soja" } });
    // A delete confirmed against the entry as it was before the rename changes nothing.
    expect(await mine.delete({ kind: "tag", id: soja.id, version: 1 })).toEqual({ stale: true });
    expect(
      await mine.merge({
        kind: "tag",
        source: { id: soy.id, version: 1 },
        target: { id: soja.id, version: 2 },
      })
    ).toMatchObject({ stale: false, entry: { id: soja.id, version: 3 } });
    expect(await mine.delete({ kind: "tag", id: soja.id, version: 3 })).toEqual({
      stale: false,
      detached: 0,
    });
    expect(await mine.list({ kind: "tag" })).toEqual([]);
    expect(realtime.published.map(({ event, target }) => [event, target])).toEqual(
      Array(5).fill(["changed", { householdId: helpers.testHouseholdOf(member.id) }])
    );
  });

  it("never offers or changes another household's entries", async () => {
    const { entry } = await (await as(member)).add({ kind: "cuisine", name: "Grandma's" });
    const stranger = await as(admin);

    expect((await stranger.list({ kind: "cuisine" })).map((e) => e.name)).not.toContain(
      "Grandma's"
    );
    await expect(
      stranger.rename({ kind: "cuisine", id: entry.id, version: 1, name: "Mine" })
    ).rejects.toThrow("Not found");
    await expect(stranger.delete({ kind: "cuisine", id: entry.id, version: 1 })).rejects.toThrow(
      "Not found"
    );
  });

  it("leaves the instance's Cuisines to an admin and the built-in Categories to nobody", async () => {
    const mine = await as(member);
    const theirs = await as(admin);
    const italian = (await mine.list({ kind: "cuisine" })).find((e) => e.name === "Italian")!;
    const dinner = (await theirs.list({ kind: "category" })).find((e) => e.name === "Dinner")!;

    expect([italian.instance, italian.editable, dinner.editable]).toEqual([true, false, false]);
    await expect(
      mine.rename({ kind: "cuisine", id: italian.id, version: italian.version, name: "Italia" })
    ).rejects.toThrow("This entry cannot be changed");
    await expect(mine.add({ kind: "cuisine", name: "Basque", instance: true })).rejects.toThrow(
      "Only an administrator adds these"
    );
    await expect(
      theirs.delete({ kind: "category", id: dinner.id, version: dinner.version })
    ).rejects.toThrow("This entry cannot be changed");
    await expect(theirs.add({ kind: "category", name: "Brunch", instance: true })).rejects.toThrow(
      "Only an administrator adds these"
    );

    const { entry: basque } = await theirs.add({ kind: "cuisine", name: "Basque", instance: true });

    expect(basque.instance).toBe(true);
    expect((await mine.list({ kind: "cuisine" })).find((e) => e.id === basque.id)).toMatchObject({
      editable: false,
    });
    expect(
      await theirs.rename({ kind: "cuisine", id: basque.id, version: 1, name: "Basque Country" })
    ).toMatchObject({ entry: { name: "Basque Country", editable: true } });
  });

  it("reads and adds to an editable recipe's household list, and only then", async () => {
    const recipe = await helpers.createTestRecipe(member.id, { name: "Soup" });
    const stranger = await as(admin);

    await (await as(member)).add({ kind: "tag", name: "soja" });
    await expect(stranger.list({ kind: "tag", recipeId: recipe.id })).rejects.toThrow(
      "You do not have permission"
    );

    await serverConfig.setConfig(
      "recipe_permission_policy",
      { view: "everyone", edit: "everyone", delete: "household" },
      null,
      false
    );

    expect(await stranger.list({ kind: "tag", recipeId: recipe.id })).toEqual([
      expect.objectContaining({ name: "soja", editable: false }),
    ]);

    const { entry } = await stranger.add({ kind: "tag", name: "Smoky", recipeId: recipe.id });

    expect(entry.editable).toBe(false);
    expect((await (await as(member)).list({ kind: "tag" })).map((e) => e.name)).toEqual([
      "Smoky",
      "soja",
    ]);
    expect(await stranger.list({ kind: "tag" })).toEqual([]);
  });
});

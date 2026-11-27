// @vitest-environment node
/**
 * An editor's save after a housemate merged one of the recipe's Tags or Cuisines on the Content
 * page: it never removes the link the merge made, and a name or id the lists lost answers stale.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@norish/shared/contracts";

import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

vi.mock("@norish/shared-server/realtime/recipes", () => import("../mocks/realtime/recipes"));
vi.mock("@norish/shared-server/realtime/lists", () => import("../mocks/realtime/lists"));
vi.mock("@norish/shared-server/realtime/config", () => import("../mocks/realtime/config"));
vi.mock("@norish/queue/enrichment/announce", () => ({ announceUsableRecipe: vi.fn() }));
vi.mock("@norish/shared-server/config/server-config-loader", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/config/server-config-loader")>()),
  getUnits: vi.fn().mockResolvedValue({}),
  getIngredientWords: vi.fn().mockResolvedValue({}),
  getRecipePermissionPolicy: vi
    .fn()
    .mockResolvedValue({ view: "household", edit: "household", delete: "household" }),
}));
vi.mock("@norish/shared-server/media/dish-color", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/media/dish-color")>()),
  refreshDishColorForRecipe: vi.fn(),
}));

describe("an editor save after a Content merge", () => {
  const testBase = new RepositoryTestBase("test_editor_save_after_merge");
  let routers: {
    recipes: typeof import("../../src/routers/recipes").recipesRouter;
    lists: typeof import("../../src/routers/lists").listsRouter;
  };
  let getRecipeFull: typeof import("@norish/db").getRecipeFull;
  let user: User;
  let householdId: string;

  beforeAll(async () => {
    await testBase.setup();
    routers = {
      recipes: (await import("../../src/routers/recipes")).recipesRouter,
      lists: (await import("../../src/routers/lists")).listsRouter,
    };
    ({ getRecipeFull } = await import("@norish/db"));
  });

  beforeEach(async () => {
    const [stored] = await testBase.beforeEachTest();
    const { getHouseholdIdForUser } = await import("@norish/db/repositories/households");

    user = { ...stored, isServerAdmin: false } as User;
    householdId = (await getHouseholdIdForUser(user.id))!;
    // The pool is reset per suite; warm it so the first write does not pay for it.
    await getRecipeFull(crypto.randomUUID());
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const context = () =>
    ({
      user,
      household: { id: householdId, name: "Home", users: [{ id: user.id, name: user.name }] },
      connectionId: null,
      operationId: null,
    }) as never;
  const recipes = () => routers.recipes.createCaller(context());
  const lists = () => routers.lists.createCaller(context());

  /** A recipe tagged "BBQ" and of the "Texan" Cuisine, both then merged into another entry. */
  async function mergedRecipe() {
    const { entry: bbq } = await lists().add({ kind: "tag", name: "BBQ" });
    const { entry: barbecue } = await lists().add({ kind: "tag", name: "Barbecue" });
    const { entry: spicy } = await lists().add({ kind: "tag", name: "Spicy" });
    const { entry: texan } = await lists().add({ kind: "cuisine", name: "Texan" });
    const { entry: american } = await lists().add({ kind: "cuisine", name: "American" });
    const id = await recipes().create({
      name: "Ribs",
      description: null,
      systemUsed: "metric",
      servings: 2,
      recipeIngredients: [{ ingredientName: "ribs", ingredientId: null, amount: 1, order: 0 }],
      steps: [{ step: "Smoke.", order: 0, systemUsed: "metric" }],
      tags: [{ name: bbq.name }],
      cuisines: [texan.id],
      categories: [],
      images: [],
      videos: [],
    });
    const opened = (await getRecipeFull(id))!;

    await lists().merge({
      kind: "tag",
      source: { id: bbq.id, version: bbq.version },
      target: { id: barbecue.id, version: barbecue.version },
    });
    await lists().merge({
      kind: "cuisine",
      source: { id: texan.id, version: texan.version },
      target: { id: american.id, version: american.version },
    });

    return { id, version: opened.version, spicy, texan };
  }

  const linksOf = async (id: string) => {
    const recipe = (await getRecipeFull(id))!;

    return {
      tags: recipe.tags.map((tag) => tag.name),
      cuisines: recipe.cuisines.map((cuisine) => cuisine.name),
    };
  };

  it("keeps the merged links when the save leaves the lists as they opened", async () => {
    const { id, version } = await mergedRecipe();

    expect(await recipes().update({ id, version, data: { name: "Smoked ribs" } })).toMatchObject({
      stale: false,
    });
    expect(await linksOf(id)).toEqual({ tags: ["Barbecue"], cuisines: ["American"] });
  });

  it("answers stale, losing nothing, for a Tag name the list no longer has", async () => {
    const { id, version, spicy } = await mergedRecipe();

    expect(
      await recipes().update({
        id,
        version,
        data: { name: "Smoked ribs", tags: [{ name: "BBQ" }, { name: spicy.name }] },
      })
    ).toEqual({ stale: true, version: null });
    expect(await linksOf(id)).toEqual({ tags: ["Barbecue"], cuisines: ["American"] });
    expect((await getRecipeFull(id))!.name).toBe("Ribs");
  });

  it("clears the times a save sends as null", async () => {
    const { id, version } = await mergedRecipe();
    const timed = await recipes().update({
      id,
      version,
      data: { prepMinutes: 10, cookMinutes: 20, totalMinutes: 30 },
    });

    await recipes().update({
      id,
      version: timed.version!,
      data: { prepMinutes: null, cookMinutes: null, totalMinutes: null },
    });
    expect(await getRecipeFull(id)).toMatchObject({
      prepMinutes: null,
      cookMinutes: null,
      totalMinutes: null,
    });
  });

  describe("after an instance Cuisine took the recipe's over", () => {
    /** A recipe of the household's "Lao", which a new instance "Lao" then takes over. */
    async function takenOver(name: string) {
      const { addEntry } = await import("@norish/db/repositories/list-entries");
      const { entry: lao } = await lists().add({ kind: "cuisine", name });
      const id = await recipes().create({
        name: "Larb",
        description: null,
        systemUsed: "metric",
        servings: 2,
        recipeIngredients: [{ ingredientName: "pork", ingredientId: null, amount: 1, order: 0 }],
        steps: [{ step: "Toss.", order: 0, systemUsed: "metric" }],
        tags: [],
        cuisines: [lao.id],
        categories: [],
        images: [],
        videos: [],
      });
      const opened = (await getRecipeFull(id))!;

      await addEntry("cuisine", null, name);

      return { id, version: opened.version, lao };
    }

    it("keeps the re-pointed link when the save leaves the Cuisines alone", async () => {
      const { id, version } = await takenOver("Lao");

      expect(await recipes().update({ id, version, data: { name: "Larb gai" } })).toMatchObject({
        stale: false,
      });
      expect((await getRecipeFull(id))!.cuisines).toEqual([
        expect.objectContaining({ name: "Lao" }),
      ]);
    });

    it("answers stale for the household Cuisine's old id", async () => {
      const { id, version, lao } = await takenOver("Isan");

      expect(
        await recipes().update({ id, version, data: { name: "Larb gai", cuisines: [lao.id] } })
      ).toEqual({ stale: true, version: null });
      expect((await getRecipeFull(id))!.cuisines).toEqual([
        expect.objectContaining({ name: "Isan" }),
      ]);
    });
  });

  it("answers stale, losing nothing, for a Cuisine the list no longer has", async () => {
    const { id, version, texan } = await mergedRecipe();

    expect(
      await recipes().update({ id, version, data: { name: "Smoked ribs", cuisines: [texan.id] } })
    ).toEqual({ stale: true, version: null });
    expect(await linksOf(id)).toEqual({ tags: ["Barbecue"], cuisines: ["American"] });
  });
});

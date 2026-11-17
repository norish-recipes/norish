// @vitest-environment node
/**
 * A recipe's id is only handed back once the recipe is stored, so a gallery upload made right
 * after the create lands on the stored recipe instead of the "pending recipe" path.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@norish/shared/contracts";

import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

const mocks = vi.hoisted(() => ({ announce: vi.fn() }));

vi.mock("@norish/shared-server/realtime/recipes", () => import("../mocks/realtime/recipes"));
vi.mock("@norish/queue/enrichment/announce", () => ({ announceUsableRecipe: mocks.announce }));
vi.mock("@norish/shared-server/config/server-config-loader", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/config/server-config-loader")>()),
  getUnits: vi.fn().mockResolvedValue({}),
  getIngredientWords: vi.fn().mockResolvedValue({}),
  getRecipePermissionPolicy: vi
    .fn()
    .mockResolvedValue({ view: "household", edit: "household", delete: "household" }),
}));
vi.mock("@norish/shared-server/media/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/media/storage")>()),
  saveImageBytes: vi.fn(async (_bytes: Buffer, recipeId: string) => {
    return `/recipes/${recipeId}/${crypto.randomUUID()}.jpg`;
  }),
}));
vi.mock("@norish/shared-server/media/dish-color", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/media/dish-color")>()),
  refreshDishColorForRecipe: vi.fn(),
}));

describe("a gallery upload right after recipes.create", () => {
  const testBase = new RepositoryTestBase("test_media_after_create");
  let user: User;
  let createCaller: typeof import("../../src/routers/recipes").recipesRouter.createCaller;
  let getRecipeFull: typeof import("@norish/db").getRecipeFull;

  beforeAll(async () => {
    await testBase.setup();
    ({
      recipesRouter: { createCaller },
    } = await import("../../src/routers/recipes"));
    ({ getRecipeFull } = await import("@norish/db"));
  });

  beforeEach(async () => {
    const [stored] = await testBase.beforeEachTest();

    user = { ...stored, isServerAdmin: false } as User;
    mocks.announce.mockReset();
    // The pool is reset per suite; warm it so the first create does not pay for it.
    await getRecipeFull(crypto.randomUUID());
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const caller = () =>
    createCaller({
      user,
      household: { id: user.id, users: [{ id: user.id, name: user.name }] },
      operationId: null,
    } as never);

  const recipe = (name: string) => ({
    name,
    description: null,
    systemUsed: "metric" as const,
    servings: 2,
    recipeIngredients: [
      { ingredientName: "eggs", ingredientId: null, amount: 2, unit: null, order: 0 },
      { ingredientName: "flour", ingredientId: null, amount: 100, unit: "g", order: 1 },
    ],
    steps: [{ step: "Mix and fry.", order: 0, systemUsed: "metric" as const }],
    tags: [{ name: "dinner" }],
    cuisines: [],
    categories: [],
    images: [],
    videos: [],
  });

  const photo = (recipeId: string, order: number) => {
    const form = new FormData();

    form.set("recipeId", recipeId);
    form.set("order", String(order));
    form.set("image", new File([new Uint8Array([1, 2, 3])], "a.jpg", { type: "image/jpeg" }));

    return form;
  };

  it("is stored when its id comes back", async () => {
    const id = await caller().create(recipe("Stored at once"));

    expect(await getRecipeFull(id)).not.toBeNull();
  });

  it.each([0, 1, 5, 20])("keeps every photo uploaded %i ms after the create", async (delay) => {
    const id = await caller().create(recipe(`Pancakes ${delay}`));

    await new Promise((resolve) => setTimeout(resolve, delay));
    const results = await Promise.all(
      [0, 1].map((order) => caller().uploadGalleryImage(photo(id, order)))
    );

    expect(results.every((result) => result.success && "id" in result && result.id)).toBe(true);
    await vi.waitFor(() => expect(mocks.announce).toHaveBeenCalled());
    expect((await getRecipeFull(id))?.images).toHaveLength(2);
  });
});

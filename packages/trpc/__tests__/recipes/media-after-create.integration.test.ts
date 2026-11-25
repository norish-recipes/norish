// @vitest-environment node
/**
 * A recipe's id is only handed back once the recipe is stored, so a gallery upload made right
 * after the create lands on the stored recipe; each gallery write on it announces the recipe.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@norish/shared/contracts";
import type { recipesRealtime } from "@norish/shared/contracts/realtime/recipes";

import type { FakeRealtimeDomain } from "../mocks/realtime";
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
  deleteImageByUrl: vi.fn(),
  deleteVideoByUrl: vi.fn(),
  saveVideoBytes: vi.fn(async (_bytes: Buffer, recipeId: string) => ({
    video: `/recipes/${recipeId}/video-1.mp4`,
    duration: 12,
  })),
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
  let realtime: FakeRealtimeDomain<typeof recipesRealtime>;

  beforeAll(async () => {
    await testBase.setup();
    ({
      recipesRouter: { createCaller },
    } = await import("../../src/routers/recipes"));
    ({ getRecipeFull } = await import("@norish/db"));
    realtime = (await import("@norish/shared-server/realtime/recipes"))
      .recipes as FakeRealtimeDomain<typeof recipesRealtime>;
  });

  beforeEach(async () => {
    const [stored] = await testBase.beforeEachTest();

    user = { ...stored, isServerAdmin: false } as User;
    mocks.announce.mockReset();
    realtime.reset();
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

  it("answers a repeated create with the same id with that recipe's id", async () => {
    const id = crypto.randomUUID();

    expect(await caller().create({ ...recipe("Once"), id })).toBe(id);
    expect(await caller().create({ ...recipe("Twice"), id })).toBe(id);
    expect((await getRecipeFull(id))?.name).toBe("Once");
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

  const clip = (recipeId: string) => {
    const form = new FormData();

    form.set("recipeId", recipeId);
    form.set("video", new File([new Uint8Array([1])], "a.mp4", { type: "video/mp4" }));

    return form;
  };

  /** The recipes each "updated" announced, in order. */
  const announced = () =>
    realtime.published
      .filter((entry) => entry.event === "updated")
      .map((entry) => (entry.payload as { recipe: { id: string } }).recipe);

  it("announces the stored recipe after each gallery upload and removal, to its household", async () => {
    const id = await caller().create(recipe("Tacos"));
    const image = await caller().uploadGalleryImage(photo(id, 0));
    const video = await caller().uploadGalleryVideo(clip(id));

    if (!("id" in image) || !image.id || !("id" in video) || !video.id) {
      throw new Error("The uploads were not stored");
    }
    expect(announced().map((r) => r.images.map((i) => i.id))).toEqual([[image.id], [image.id]]);
    expect(announced()[1]?.videos.map((v) => v.id)).toEqual([video.id]);
    expect(realtime.published.find((entry) => entry.event === "updated")?.target).toEqual(
      expect.objectContaining({ viewPolicy: "household", householdId: user.id })
    );

    await caller().deleteGalleryImage({ imageId: image.id, version: image.version ?? 1 });
    await caller().deleteGalleryVideo({ videoId: video.id, version: video.version ?? 1 });

    expect(announced().slice(2)).toEqual([
      expect.objectContaining({ images: [], videos: [expect.objectContaining({ id: video.id })] }),
      expect.objectContaining({ images: [], videos: [] }),
    ]);
  });

  it("links a photo and a video sent while their recipe's create is still running", async () => {
    const id = crypto.randomUUID();
    const creating = caller().create({ ...recipe("In flight"), id });
    const [image, video] = await Promise.all([
      caller().uploadGalleryImage(photo(id, 0)),
      caller().uploadGalleryVideo(clip(id)),
    ]);

    await creating;
    expect(image).toMatchObject({ success: true, id: expect.any(String) });
    expect(video).toMatchObject({ success: true, id: expect.any(String) });
    expect(await getRecipeFull(id)).toMatchObject({
      images: [expect.anything()],
      videos: [expect.anything()],
    });
  });

  it("removes neither the file nor the row on a stale gallery delete", async () => {
    const { deleteImageByUrl, deleteVideoByUrl } =
      await import("@norish/shared-server/media/storage");
    const id = await caller().create(recipe("Kept"));
    const image = await caller().uploadGalleryImage(photo(id, 0));
    const video = await caller().uploadGalleryVideo(clip(id));

    if (!("id" in image) || !image.id || !("id" in video) || !video.id) {
      throw new Error("The uploads were not stored");
    }
    vi.mocked(deleteImageByUrl).mockClear();
    vi.mocked(deleteVideoByUrl).mockClear();

    await caller().deleteGalleryImage({ imageId: image.id, version: (image.version ?? 1) + 1 });
    await caller().deleteGalleryVideo({ videoId: video.id, version: (video.version ?? 1) + 1 });

    expect(deleteImageByUrl).not.toHaveBeenCalled();
    expect(deleteVideoByUrl).not.toHaveBeenCalled();
    expect(await getRecipeFull(id)).toMatchObject({
      images: [expect.objectContaining({ id: image.id })],
      videos: [expect.objectContaining({ id: video.id })],
    });
  });

  it("announces nothing for media uploaded before its recipe is stored, or a stale removal", async () => {
    const pendingId = crypto.randomUUID();

    await caller().uploadGalleryImage(photo(pendingId, 0));
    const id = await caller().create(recipe("Steak"));
    const image = await caller().uploadGalleryImage(photo(id, 0));

    if (!("id" in image) || !image.id) throw new Error("The upload was not stored");
    realtime.reset();
    await caller().deleteGalleryImage({ imageId: image.id, version: (image.version ?? 1) + 1 });

    expect(announced()).toEqual([]);
  });
});

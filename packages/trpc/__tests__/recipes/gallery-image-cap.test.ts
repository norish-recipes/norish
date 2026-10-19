// @vitest-environment node
/**
 * The gallery upload procedure at its real boundary: the Source Image cap is
 * decided by the repository guard, an over-cap upload removes the file it just
 * wrote, and a pending recipe keeps its URL for the form to link.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { imagesProcedures } from "@norish/trpc/routers/recipes/images";
import { createCallerFactory } from "@norish/trpc/trpc";

import { createMockAuthedContext } from "./test-utils";

const mocks = vi.hoisted(() => ({
  addGalleryImageWithinCap: vi.fn(),
  saveImageBytes: vi.fn(async () => "/recipes/recipe-id/uploaded.jpg"),
  deleteImageByUrl: vi.fn(async () => undefined),
  isImageUrlReferenced: vi.fn(async () => false),
  isStepImageUrlReferenced: vi.fn(async () => false),
  getRecipeImageById: vi.fn(),
  deleteRecipeImageById: vi.fn(),
  deleteStepImageByUrl: vi.fn(async () => undefined),
  refreshDishColorForRecipe: vi.fn(async () => undefined),
}));

vi.mock("@norish/db/repositories/recipes", () => ({
  addGalleryImageWithinCap: mocks.addGalleryImageWithinCap,
  deleteRecipeImageById: mocks.deleteRecipeImageById,
  getRecipeImageById: mocks.getRecipeImageById,
  isImageUrlReferenced: mocks.isImageUrlReferenced,
}));

vi.mock("@norish/db/repositories/steps", () => ({
  isStepImageUrlReferenced: mocks.isStepImageUrlReferenced,
}));

vi.mock("@norish/shared-server/media/storage", () => ({
  saveImageBytes: mocks.saveImageBytes,
  deleteImageByUrl: mocks.deleteImageByUrl,
  saveStepImageBytes: vi.fn(),
  deleteStepImageByUrl: mocks.deleteStepImageByUrl,
}));

vi.mock("@norish/shared-server/media/dish-color", () => ({
  refreshDishColorForRecipe: mocks.refreshDishColorForRecipe,
}));

vi.mock("@norish/shared-server/logger", () => {
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() };

  return {
    trpcLogger: logger,
    serverLogger: logger,
    mediaLogger: logger,
    createLogger: () => logger,
    createClientLogger: () => logger,
  };
});

const RECIPE_ID = "11111111-1111-4111-8111-111111111111";

function uploadForm(order?: string) {
  const form = new FormData();

  form.append("image", new File(["fake-bytes"], "photo.jpg", { type: "image/jpeg" }));
  form.append("recipeId", RECIPE_ID);
  if (order !== undefined) form.append("order", order);

  return form;
}

function caller() {
  return createCallerFactory(imagesProcedures)({
    ...createMockAuthedContext(),
    connectionId: null,
    operationId: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

const IMAGE_ID = "22222222-2222-4222-8222-222222222222";
const SHARED_URL = "/recipes/11111111-1111-4111-8111-111111111111/shared.jpg";

describe("gallery image delete", () => {
  it("deletes the row first and keeps a file another row uses", async () => {
    mocks.getRecipeImageById.mockResolvedValue({
      id: IMAGE_ID,
      recipeId: RECIPE_ID,
      image: SHARED_URL,
    });
    mocks.deleteRecipeImageById.mockResolvedValue({
      applied: true,
      stale: false,
      value: undefined,
    });
    mocks.isImageUrlReferenced.mockResolvedValue(true);

    expect(await caller().deleteGalleryImage({ imageId: IMAGE_ID, version: 1 })).toEqual({
      success: true,
      stale: false,
    });
    expect(mocks.deleteRecipeImageById).toHaveBeenCalledWith(IMAGE_ID, 1);
    expect(mocks.isImageUrlReferenced).toHaveBeenCalledWith(SHARED_URL);
    expect(mocks.deleteImageByUrl).not.toHaveBeenCalled();
  });

  it("returns stale without a reference check or an unlink", async () => {
    mocks.getRecipeImageById.mockResolvedValue({
      id: IMAGE_ID,
      recipeId: RECIPE_ID,
      image: SHARED_URL,
    });
    mocks.deleteRecipeImageById.mockResolvedValue({ applied: false, stale: true });

    expect(await caller().deleteGalleryImage({ imageId: IMAGE_ID, version: 1 })).toEqual({
      success: true,
      stale: true,
    });
    expect(mocks.isImageUrlReferenced).not.toHaveBeenCalled();
    expect(mocks.deleteImageByUrl).not.toHaveBeenCalled();
  });

  it("removes the file when no row uses it", async () => {
    mocks.getRecipeImageById.mockResolvedValue({
      id: IMAGE_ID,
      recipeId: RECIPE_ID,
      image: SHARED_URL,
    });
    mocks.deleteRecipeImageById.mockResolvedValue({
      applied: true,
      stale: false,
      value: undefined,
    });
    mocks.isImageUrlReferenced.mockResolvedValue(false);

    expect(await caller().deleteGalleryImage({ imageId: IMAGE_ID, version: 1 })).toEqual({
      success: true,
      stale: false,
    });
    expect(mocks.deleteImageByUrl).toHaveBeenCalledWith(SHARED_URL);
  });
});

describe("legacy image delete by URL", () => {
  it("keeps a URL that a row still uses", async () => {
    mocks.isImageUrlReferenced.mockResolvedValue(true);

    expect(await caller().deleteImage({ url: SHARED_URL })).toEqual({ success: true });
    expect(mocks.deleteImageByUrl).not.toHaveBeenCalled();
  });

  it("removes a URL that no row uses", async () => {
    mocks.isImageUrlReferenced.mockResolvedValue(false);

    expect(await caller().deleteImage({ url: SHARED_URL })).toEqual({ success: true });
    expect(mocks.deleteImageByUrl).toHaveBeenCalledWith(SHARED_URL);
  });
});

describe("step image delete by URL", () => {
  it("keeps a URL that a step row still uses", async () => {
    mocks.isStepImageUrlReferenced.mockResolvedValue(true);

    expect(
      await caller().deleteStepImage({
        url: "/recipes/11111111-1111-4111-8111-111111111111/steps/shared.jpg",
      })
    ).toEqual({ success: true });
    expect(mocks.deleteStepImageByUrl).not.toHaveBeenCalled();
  });
});

describe("uploadGalleryImage under the Source Image cap", () => {
  it("returns the cap error and removes the file it just wrote", async () => {
    mocks.addGalleryImageWithinCap.mockResolvedValue({ status: "cap-reached" });

    const result = await caller().uploadGalleryImage(uploadForm());

    expect(result).toEqual({
      success: false,
      error: "Maximum 10 images allowed per recipe",
    });
    expect(mocks.deleteImageByUrl).toHaveBeenCalledWith("/recipes/recipe-id/uploaded.jpg");
  });

  it("does not unlink a file that an existing row already uses", async () => {
    // Storage is content-addressed: the loser of a duplicate upload lands on
    // the winner's URL. The winner's row still names it, so the file stays.
    mocks.addGalleryImageWithinCap.mockResolvedValue({ status: "cap-reached" });
    mocks.isImageUrlReferenced.mockResolvedValue(true);

    expect(await caller().uploadGalleryImage(uploadForm())).toEqual({
      success: false,
      error: "Maximum 10 images allowed per recipe",
    });
    expect(mocks.isImageUrlReferenced).toHaveBeenCalledWith("/recipes/recipe-id/uploaded.jpg");
    expect(mocks.deleteImageByUrl).not.toHaveBeenCalled();
  });

  it("keeps the file when the reference check itself fails", async () => {
    mocks.addGalleryImageWithinCap.mockResolvedValue({ status: "cap-reached" });
    mocks.isImageUrlReferenced.mockRejectedValue(new Error("database is down"));

    expect(await caller().uploadGalleryImage(uploadForm())).toEqual({
      success: false,
      error: "Maximum 10 images allowed per recipe",
    });
    expect(mocks.deleteImageByUrl).not.toHaveBeenCalled();
  });

  it("returns the stored row and recomputes the Dish Colour", async () => {
    mocks.addGalleryImageWithinCap.mockResolvedValue({
      status: "added",
      image: { id: "image-id", image: "/recipes/recipe-id/uploaded.jpg", order: 7, version: 2 },
    });

    const result = await caller().uploadGalleryImage(uploadForm("7"));

    expect(result).toEqual({
      success: true,
      url: "/recipes/recipe-id/uploaded.jpg",
      id: "image-id",
      order: 7,
      version: 2,
    });
    expect(mocks.addGalleryImageWithinCap).toHaveBeenCalledWith(
      RECIPE_ID,
      "/recipes/recipe-id/uploaded.jpg",
      7
    );
    expect(mocks.refreshDishColorForRecipe).toHaveBeenCalledWith(RECIPE_ID);
  });

  it("keeps the URL for a recipe that does not exist yet", async () => {
    mocks.addGalleryImageWithinCap.mockResolvedValue({ status: "recipe-missing" });

    expect(await caller().uploadGalleryImage(uploadForm())).toEqual({
      success: true,
      url: "/recipes/recipe-id/uploaded.jpg",
      order: 0,
    });
    expect(mocks.refreshDishColorForRecipe).not.toHaveBeenCalled();
    expect(mocks.deleteImageByUrl).not.toHaveBeenCalled();
  });
});

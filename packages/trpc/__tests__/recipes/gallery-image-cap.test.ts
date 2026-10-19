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
  refreshDishColorForRecipe: vi.fn(async () => undefined),
}));

vi.mock("@norish/db/repositories/recipes", () => ({
  addGalleryImageWithinCap: mocks.addGalleryImageWithinCap,
  deleteRecipeImageById: vi.fn(),
  getRecipeImageById: vi.fn(),
  isImageUrlReferenced: mocks.isImageUrlReferenced,
}));

vi.mock("@norish/shared-server/media/storage", () => ({
  saveImageBytes: mocks.saveImageBytes,
  deleteImageByUrl: mocks.deleteImageByUrl,
  saveStepImageBytes: vi.fn(),
  deleteStepImageByUrl: vi.fn(),
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

// @vitest-environment node

import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockAuthedContext, createMockHousehold, createMockUser } from "./test-utils";

const assertRecipeAccessMock = vi.hoisted(() => vi.fn());
const saveImageBytesMock = vi.hoisted(() => vi.fn());
const deleteImageByUrlMock = vi.hoisted(() => vi.fn());
const deleteStepImageByUrlMock = vi.hoisted(() => vi.fn());
const saveVideoBytesMock = vi.hoisted(() => vi.fn());
const getRecipeImageByIdMock = vi.hoisted(() => vi.fn());
const getRecipeVideoByIdMock = vi.hoisted(() => vi.fn());
const deleteRecipeImageByIdMock = vi.hoisted(() => vi.fn());
const getCachedHouseholdForUserMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/routers/recipes/helpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/routers/recipes/helpers")>()),
  assertRecipeAccess: assertRecipeAccessMock,
}));

vi.mock("@norish/shared-server/realtime/recipes", () => import("../mocks/realtime/recipes"));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getMaxVideoFileSize: vi.fn().mockResolvedValue(100 * 1024 * 1024),
  getRecipePermissionPolicy: vi.fn(),
}));

vi.mock("@norish/shared-server/media/storage", () => ({
  saveImageBytes: saveImageBytesMock,
  saveStepImageBytes: vi.fn(),
  deleteImageByUrl: deleteImageByUrlMock,
  deleteStepImageByUrl: deleteStepImageByUrlMock,
  saveVideoBytes: saveVideoBytesMock,
  deleteVideoByUrl: vi.fn(),
}));

vi.mock("@norish/shared-server/media/dish-color", () => ({
  refreshDishColorForRecipe: vi.fn(),
}));

vi.mock("@norish/db/repositories/recipes", () => ({
  addRecipeImages: vi.fn(),
  countRecipeImages: vi.fn().mockResolvedValue(0),
  deleteRecipeImageById: deleteRecipeImageByIdMock,
  getRecipeImageById: getRecipeImageByIdMock,
  getRecipeOwnerId: vi.fn().mockResolvedValue(null),
  addRecipeVideos: vi.fn(),
  countRecipeVideos: vi.fn().mockResolvedValue(0),
  deleteRecipeVideoById: vi.fn(),
  getRecipeVideoById: getRecipeVideoByIdMock,
  getRecipeFull: vi.fn(),
}));

vi.mock("@norish/db", () => ({
  getCachedHouseholdForUser: getCachedHouseholdForUserMock,
  isUserServerAdmin: vi.fn().mockResolvedValue(false),
}));

const { imagesProcedures } = await import("../../src/routers/recipes/images");
const { videosProcedures } = await import("../../src/routers/recipes/videos");

describe("recipe media procedures check the recipe before touching files", () => {
  const user = createMockUser();
  const household = createMockHousehold();
  const recipeId = "123e4567-e89b-12d3-a456-426614174000";
  const ctx = { ...createMockAuthedContext(user, household), operationId: null };
  const forbidden = new TRPCError({ code: "FORBIDDEN", message: "No" });

  function upload(field: "image" | "video", id: string) {
    const formData = new FormData();

    formData.append("recipeId", id);
    formData.append(
      field,
      field === "image"
        ? new File(["x"], "x.jpg", { type: "image/jpeg" })
        : new File(["x"], "x.mp4", { type: "video/mp4" })
    );

    return formData;
  }

  beforeEach(() => {
    getCachedHouseholdForUserMock.mockResolvedValue(household);
    assertRecipeAccessMock.mockResolvedValue(undefined);
    saveImageBytesMock.mockResolvedValue(`/recipes/${recipeId}/a.jpg`);
  });

  it("refuses a recipe id that is a path, and writes nothing", async () => {
    const caller = imagesProcedures.createCaller(ctx as never);

    const result = await caller.uploadImage(upload("image", "../../etc"));

    expect(result).toEqual({ success: false, error: "Recipe ID is required" });
    expect(saveImageBytesMock).not.toHaveBeenCalled();
  });

  it("uploads to a recipe only once the caller may edit it", async () => {
    const caller = imagesProcedures.createCaller(ctx as never);

    assertRecipeAccessMock.mockRejectedValue(forbidden);

    await expect(caller.uploadGalleryImage(upload("image", recipeId))).rejects.toThrow(forbidden);
    expect(assertRecipeAccessMock).toHaveBeenCalledWith(expect.anything(), recipeId, "edit");
    expect(saveImageBytesMock).not.toHaveBeenCalled();

    const videos = videosProcedures.createCaller(ctx as never);

    await expect(videos.uploadGalleryVideo(upload("video", recipeId))).rejects.toThrow(forbidden);
    expect(saveVideoBytesMock).not.toHaveBeenCalled();
  });

  it("deletes another recipe's image only once the caller may edit that recipe", async () => {
    const caller = imagesProcedures.createCaller(ctx as never);
    const otherRecipe = "123e4567-e89b-12d3-a456-426614174999";

    assertRecipeAccessMock.mockRejectedValue(forbidden);
    getRecipeImageByIdMock.mockResolvedValue({
      id: "123e4567-e89b-12d3-a456-426614174001",
      recipeId: otherRecipe,
      image: `/recipes/${otherRecipe}/a.jpg`,
    });

    await expect(
      caller.deleteGalleryImage({ imageId: "123e4567-e89b-12d3-a456-426614174001", version: 1 })
    ).rejects.toThrow(forbidden);
    await expect(caller.deleteImage({ url: `/recipes/${otherRecipe}/a.jpg` })).rejects.toThrow(
      forbidden
    );
    await expect(
      caller.deleteStepImage({ url: `/recipes/${otherRecipe}/steps/a.jpg` })
    ).rejects.toThrow(forbidden);

    expect(assertRecipeAccessMock).toHaveBeenCalledWith(expect.anything(), otherRecipe, "edit");
    expect(deleteImageByUrlMock).not.toHaveBeenCalled();
    expect(deleteStepImageByUrlMock).not.toHaveBeenCalled();
    expect(deleteRecipeImageByIdMock).not.toHaveBeenCalled();
  });

  it("refuses a media URL outside a recipe folder", async () => {
    const caller = imagesProcedures.createCaller(ctx as never);

    const result = await caller.deleteImage({ url: "/avatars/someone.jpg" });

    expect(result).toEqual({ success: false, error: "Invalid image URL format" });
    expect(deleteImageByUrlMock).not.toHaveBeenCalled();
  });
});

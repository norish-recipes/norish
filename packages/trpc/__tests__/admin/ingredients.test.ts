// @vitest-environment node
/**
 * Ingredient Name administration (ADR-0037). The repository, media and
 * queue are mocked; what is pinned here is who may write, how a repository
 * outcome reaches the administrator, and that a picture is only ever asked of
 * a server that can draw one.
 */
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ingredientsAdminProcedures } from "../../src/routers/admin/ingredients";
import { ingredientsRouter } from "../../src/routers/ingredients";
import { createMockCallerContext } from "../calendar/test-utils";
import { createMockAdminContext, createMockAuthedContext, createMockUser } from "./test-utils";

const repository = vi.hoisted(() => ({
  createIngredientWithDetails: vi.fn(),
  updateIngredientDetails: vi.fn(),
  deleteIngredientIfUnused: vi.fn(),
  findIngredientForAdmin: vi.fn(),
  listIngredientIdsMissingImage: vi.fn(),
  countIngredientsMissingImage: vi.fn(),
  listIngredientsForAdmin: vi.fn(),
  listIngredientNames: vi.fn(),
}));

const media = vi.hoisted(() => ({
  IngredientIllustrationInputError: class IngredientIllustrationInputError extends Error {},
  storeIngredientIllustration: vi.fn(),
  removeIngredientIllustration: vi.fn(),
  sweepIngredientIllustrations: vi.fn(),
}));

const queue = vi.hoisted(() => ({ addIngredientIllustrationJob: vi.fn() }));
const config = vi.hoisted(() => ({
  isAIEnabled: vi.fn(),
  isImageGenerationConfigured: vi.fn(),
}));
const users = vi.hoisted(() => ({ isUserServerAdmin: vi.fn() }));

vi.mock("@norish/db", () => ({ isUserServerAdmin: users.isUserServerAdmin }));
vi.mock("@norish/db/repositories/ingredient-pictures", () => repository);
vi.mock("@norish/shared-server/media/ingredient-illustration", () => media);
vi.mock("@norish/queue/ingredient-illustration/producer", () => queue);
vi.mock("@norish/queue/registry", () => ({
  getQueues: () => ({ ingredientIllustration: { name: "ingredient-illustration" } }),
}));
vi.mock("@norish/shared-server/config/server-config-loader", () => config);
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const ID = "11111111-1111-4111-8111-111111111111";
const EGG = {
  id: ID,
  name: "Egg",
  imageUrl: null,
  version: 1,
  recipeCount: 0,
};

const admin = ingredientsAdminProcedures.createCaller(
  createMockCallerContext(createMockAdminContext())
);
const member = ingredientsAdminProcedures.createCaller(
  createMockCallerContext(createMockAuthedContext(createMockUser()))
);

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  return promise.then(
    () => undefined,
    (error: unknown) => (error instanceof TRPCError ? error.code : String(error))
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  users.isUserServerAdmin.mockImplementation(async (id: string) => id === "test-admin-id");
  config.isAIEnabled.mockResolvedValue(true);
  config.isImageGenerationConfigured.mockResolvedValue(true);
  repository.findIngredientForAdmin.mockResolvedValue(EGG);
});

describe("governance", () => {
  it("refuses every write to someone who is not an administrator", async () => {
    expect(await codeOf(member.create({ name: "Egg" }))).toBe("FORBIDDEN");
    expect(await codeOf(member.generateImage({ id: ID }))).toBe("FORBIDDEN");
    expect(repository.createIngredientWithDetails).not.toHaveBeenCalled();
  });

  it("keeps the full list to administrators", async () => {
    expect(await codeOf(member.list({}))).toBe("FORBIDDEN");

    repository.listIngredientsForAdmin.mockResolvedValue({
      items: [EGG],
      nextCursor: null,
      total: 1,
    });

    expect(await admin.list({ search: "eg" })).toEqual({
      items: [EGG],
      nextCursor: null,
      total: 1,
    });
    expect(repository.listIngredientsForAdmin).toHaveBeenCalledWith({ search: "eg", limit: 50 });
  });

  it("lets any signed-in reader list every name", async () => {
    const name = { id: ID, name: "Egg", imageUrl: "/e.webp" };

    repository.listIngredientNames.mockResolvedValue([name]);

    const reader = ingredientsRouter.createCaller(
      createMockCallerContext(createMockAuthedContext(createMockUser()))
    );

    expect(await reader.list()).toEqual({ ingredients: [name] });
  });
});

describe("writes", () => {
  it("returns the created name", async () => {
    repository.createIngredientWithDetails.mockResolvedValue({ status: "ok", ingredient: EGG });

    expect(await admin.create({ name: "Egg" })).toEqual(EGG);
  });

  it("names the ingredient a duplicate name already belongs to", async () => {
    repository.createIngredientWithDetails.mockResolvedValue({
      status: "duplicate",
      name: "cilantro",
      ownerName: "Coriander",
    });

    await expect(admin.create({ name: "Cilantro" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: '"cilantro" already belongs to Coriander',
    });
  });

  it.each([
    [{ status: "stale" }, "CONFLICT"],
    [{ status: "not-found" }, "NOT_FOUND"],
    [{ status: "invalid-name", name: "!!" }, "BAD_REQUEST"],
  ])("maps %o to %s", async (result, code) => {
    repository.updateIngredientDetails.mockResolvedValue(result);

    expect(await codeOf(admin.update({ id: ID, version: 1, name: "Egg" }))).toBe(code);
  });

  it("sweeps a deleted name's pictures", async () => {
    repository.deleteIngredientIfUnused.mockResolvedValue({
      status: "ok",
      imageUrl: "/ingredient-images/x.webp",
    });

    expect(await admin.delete({ id: ID })).toEqual({ success: true });
    expect(media.sweepIngredientIllustrations).toHaveBeenCalledWith(ID);
  });

  it("refuses to delete a name recipes use, saying how many", async () => {
    repository.deleteIngredientIfUnused.mockResolvedValue({ status: "in-use", recipeCount: 3 });

    await expect(admin.delete({ id: ID })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This ingredient is used by 3 recipes and cannot be deleted",
    });
    expect(media.sweepIngredientIllustrations).not.toHaveBeenCalled();
  });
});

describe("pictures", () => {
  it("queues a drawing for one name", async () => {
    queue.addIngredientIllustrationJob.mockResolvedValue("queued");

    expect(await admin.generateImage({ id: ID })).toEqual({ status: "queued" });
    expect(queue.addIngredientIllustrationJob).toHaveBeenCalledWith(
      { name: "ingredient-illustration" },
      { ingredientId: ID, requestedByUserId: "test-admin-id" }
    );
  });

  it("refuses to queue a drawing a server cannot make", async () => {
    config.isImageGenerationConfigured.mockResolvedValue(false);

    expect(await codeOf(admin.generateImage({ id: ID }))).toBe("PRECONDITION_FAILED");

    config.isImageGenerationConfigured.mockResolvedValue(true);
    config.isAIEnabled.mockResolvedValue(false);

    expect(await codeOf(admin.generateMissing())).toBe("PRECONDITION_FAILED");
    expect(queue.addIngredientIllustrationJob).not.toHaveBeenCalled();
  });

  it("counts and queues every name without a picture, not counting ones already queued", async () => {
    const other = "22222222-2222-4222-8222-222222222222";

    repository.listIngredientIdsMissingImage.mockResolvedValue([ID, other]);
    repository.countIngredientsMissingImage.mockResolvedValue(2);
    queue.addIngredientIllustrationJob
      .mockResolvedValueOnce("queued")
      .mockResolvedValueOnce("duplicate");

    expect(await admin.missingImageCount()).toEqual({ configured: true, count: 2 });
    expect(await admin.generateMissing()).toEqual({ queued: 1, ids: [ID, other] });
  });

  it("stores an uploaded picture", async () => {
    media.storeIngredientIllustration.mockResolvedValue("/ingredient-images/new.webp");

    const form = new FormData();

    form.set("id", ID);
    form.set("image", new File([new Uint8Array([1, 2, 3])], "egg.png", { type: "image/png" }));

    expect(await admin.uploadImage(form)).toEqual({ imageUrl: "/ingredient-images/new.webp" });
    expect(media.storeIngredientIllustration).toHaveBeenCalledWith(ID, expect.any(Buffer));
  });

  it("tells a file that cannot be read apart from a server that cannot save it", async () => {
    const form = () => {
      const data = new FormData();

      data.set("id", ID);
      data.set("image", new File([new Uint8Array([1, 2, 3])], "egg.png", { type: "image/png" }));

      return data;
    };

    media.storeIngredientIllustration.mockRejectedValueOnce(
      new media.IngredientIllustrationInputError("Buffer is not a valid image")
    );
    expect(await codeOf(admin.uploadImage(form()))).toBe("BAD_REQUEST");

    media.storeIngredientIllustration.mockRejectedValueOnce(
      Object.assign(new Error("ENOENT: no such file or directory, mkdir '/app'"), {
        code: "ENOENT",
      })
    );
    expect(await codeOf(admin.uploadImage(form()))).toBe("INTERNAL_SERVER_ERROR");
  });

  it("refuses an upload that is not an allowed image type", async () => {
    const form = new FormData();

    form.set("id", ID);
    form.set("image", new File(["hello"], "egg.txt", { type: "text/plain" }));

    expect(await codeOf(admin.uploadImage(form))).toBe("BAD_REQUEST");
    expect(media.storeIngredientIllustration).not.toHaveBeenCalled();
  });
});

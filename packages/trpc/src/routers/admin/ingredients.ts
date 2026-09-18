/**
 * Ingredient Name administration (ADR-0037): every name recipes have used,
 * with its picture.
 *
 * Only an administrator writes these. Every procedure delegates to the
 * ingredient-pictures repository or the illustration media module rather than
 * composing queries or touching files here.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { IngredientDetailsWriteResult } from "@norish/db/repositories/ingredient-pictures";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import {
  countIngredientsMissingImage,
  createIngredientWithDetails,
  deleteIngredientIfUnused,
  findIngredientForAdmin,
  listIngredientIdsMissingImage,
  listIngredientsForAdmin,
  updateIngredientDetails,
} from "@norish/db/repositories/ingredient-pictures";
import { addIngredientIllustrationJob } from "@norish/queue/ingredient-illustration/producer";
import { getQueues } from "@norish/queue/registry";
import {
  isAIEnabled,
  isImageGenerationConfigured,
} from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  IngredientIllustrationInputError,
  removeIngredientIllustration,
  storeIngredientIllustration,
  sweepIngredientIllustrations,
} from "@norish/shared-server/media/ingredient-illustration";
import { ALLOWED_IMAGE_MIME_SET } from "@norish/shared/contracts";
import {
  AdminIngredientListInputSchema,
  IngredientDetailsCreateSchema,
  IngredientDetailsUpdateSchema,
} from "@norish/shared/contracts/zod";

import { formDataInputSchema, getFormDataString, getUploadedFile } from "../../form-data";
import { adminProcedure } from "../../middleware";
import { router } from "../../trpc";

/** Turn a repository outcome into the ingredient, or the error the administrator needs to act on. */
function unwrap(result: IngredientDetailsWriteResult) {
  switch (result.status) {
    case "ok":
      return result.ingredient;
    case "duplicate":
      throw new TRPCError({
        code: "CONFLICT",
        message: `"${result.name}" already belongs to ${result.ownerName}`,
        cause: { name: result.name, ownerName: result.ownerName },
      });
    case "invalid-name":
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `"${result.name}" is not a usable ingredient name`,
      });
    case "stale":
      throw new TRPCError({
        code: "CONFLICT",
        message: "This ingredient was changed by someone else. Reload and try again.",
      });
    case "not-found":
      throw new TRPCError({ code: "NOT_FOUND", message: "Ingredient not found" });
  }
}

async function canGenerate(): Promise<boolean> {
  return (await isAIEnabled()) && (await isImageGenerationConfigured());
}

async function assertCanGenerate(): Promise<void> {
  if (!(await canGenerate())) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No image provider is configured on this server",
    });
  }
}

/** One page of every Ingredient Name, searchable, with how many recipe lines use each. */
const list = adminProcedure.input(AdminIngredientListInputSchema).query(async ({ input }) => {
  return await listIngredientsForAdmin(input);
});

const create = adminProcedure
  .input(IngredientDetailsCreateSchema)
  .mutation(async ({ ctx, input }) => {
    log.info({ userId: ctx.user.id, name: input.name }, "Adding an Ingredient Name");

    return unwrap(await createIngredientWithDetails(input));
  });

const update = adminProcedure
  .input(IngredientDetailsUpdateSchema)
  .mutation(async ({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ingredientId: input.id }, "Updating an Ingredient Name");

    return unwrap(await updateIngredientDetails(input));
  });

/**
 * Remove an Ingredient Name no recipe uses, and its picture files. A used name
 * is refused: deleting it would delete the recipe lines that show it, and the
 * Pantry Ingredients that point at it.
 */
const remove = adminProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
  log.info({ userId: ctx.user.id, ingredientId: input.id }, "Deleting an Ingredient Name");

  const result = await deleteIngredientIfUnused(input.id);

  switch (result.status) {
    case "not-found":
      throw new TRPCError({ code: "NOT_FOUND", message: "Ingredient not found" });
    case "in-use": {
      const holders = [
        result.recipeCount > 0 &&
          `${result.recipeCount} ${result.recipeCount === 1 ? "recipe" : "recipes"}`,
        result.pantryCount > 0 &&
          `${result.pantryCount} ${result.pantryCount === 1 ? "pantry" : "pantries"}`,
      ].filter(Boolean);

      throw new TRPCError({
        code: "CONFLICT",
        message: `This ingredient is used by ${holders.join(" and ")} and cannot be deleted`,
        cause: { recipeCount: result.recipeCount, pantryCount: result.pantryCount },
      });
    }
    case "ok":
      await sweepIngredientIllustrations(input.id);

      return { success: true };
  }
});

/** Upload a picture for an Ingredient Name (FormData: `id`, `image`). */
const uploadImage = adminProcedure.input(formDataInputSchema).mutation(async ({ ctx, input }) => {
  const parsedId = z.uuid().safeParse(getFormDataString(input, "id"));

  if (!parsedId.success) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Ingredient id is required" });
  }

  const file = getUploadedFile(input, "image");

  if (!file) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No image file provided" });
  }

  if (!ALLOWED_IMAGE_MIME_SET.has(file.type)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid file type. Only JPEG, PNG, WebP, and AVIF images are allowed.",
    });
  }

  if (file.size > SERVER_CONFIG.MAX_IMAGE_FILE_SIZE) {
    const maxMB = Math.round(SERVER_CONFIG.MAX_IMAGE_FILE_SIZE / 1024 / 1024);

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `File too large. Maximum size is ${maxMB}MB.`,
    });
  }

  log.info({ userId: ctx.user.id, ingredientId: parsedId.data }, "Uploading an ingredient picture");

  let imageUrl: string | null;

  try {
    imageUrl = await storeIngredientIllustration(
      parsedId.data,
      Buffer.from(await file.arrayBuffer())
    );
  } catch (err) {
    if (err instanceof IngredientIllustrationInputError) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "That file could not be read as an image",
        cause: err,
      });
    }

    // Writing the file or the row failed: the server's problem, not the file's.
    log.error(
      { err, userId: ctx.user.id, ingredientId: parsedId.data },
      "Could not store an ingredient picture"
    );
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The picture could not be saved on the server",
      cause: err,
    });
  }

  if (!imageUrl) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Ingredient not found" });
  }

  return { imageUrl };
});

const removeImage = adminProcedure
  .input(z.object({ id: z.uuid() }))
  .mutation(async ({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ingredientId: input.id }, "Removing an ingredient picture");

    if (!(await removeIngredientIllustration(input.id))) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Ingredient not found" });
    }

    return { success: true };
  });

/** Ask the image model to draw one Ingredient Name. Replaces any picture it has. */
const generateImage = adminProcedure
  .input(z.object({ id: z.uuid() }))
  .mutation(async ({ ctx, input }) => {
    await assertCanGenerate();

    if (!(await findIngredientForAdmin(input.id))) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Ingredient not found" });
    }

    const status = await addIngredientIllustrationJob(getQueues().ingredientIllustration, {
      ingredientId: input.id,
      requestedByUserId: ctx.user.id,
    });

    log.info(
      { userId: ctx.user.id, ingredientId: input.id, status },
      "Requested an ingredient picture"
    );

    return { status };
  });

/** How many used or aliased names have no picture, and whether they could be drawn. */
const missingImageCount = adminProcedure.query(async () => {
  const [configured, count] = await Promise.all([canGenerate(), countIngredientsMissingImage()]);

  return { configured, count };
});

/** Draw every used or aliased name that has no picture yet. Names already queued are not queued twice. */
const generateMissing = adminProcedure.mutation(async ({ ctx }) => {
  await assertCanGenerate();

  const queue = getQueues().ingredientIllustration;
  const ids = await listIngredientIdsMissingImage();
  let queued = 0;

  for (const ingredientId of ids) {
    const status = await addIngredientIllustrationJob(queue, {
      ingredientId,
      requestedByUserId: ctx.user.id,
    });

    if (status === "queued") queued++;
  }

  log.info(
    { userId: ctx.user.id, queued, missing: ids.length },
    "Requested missing ingredient pictures"
  );

  return { queued, ids };
});

export const ingredientsAdminProcedures = router({
  list,
  create,
  update,
  delete: remove,
  uploadImage,
  removeImage,
  generateImage,
  missingImageCount,
  generateMissing,
});

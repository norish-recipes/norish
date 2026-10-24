import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { EquipmentCatalogueRefusal } from "@norish/shared/contracts/zod/equipment";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { findEquipmentFor, listEquipmentUses } from "@norish/db/repositories/equipment";
import {
  createEquipment,
  deleteEquipment,
  EquipmentEditError,
  listEquipment,
  mergeEquipment,
  saveEquipmentDraft,
  uploadEquipmentIcon,
} from "@norish/shared-server/equipment/catalogue";
import { equipmentIconAddresses } from "@norish/shared-server/equipment/icons";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { ICON_FILE_PATTERN } from "@norish/shared-server/media/ingredient-icon";
import { ICON_PICTURE_MIME_TYPES } from "@norish/shared/contracts";
import {
  INGREDIENT_SEARCH_FIELDS,
  INGREDIENT_SEARCH_MATCHES,
} from "@norish/shared/lib/ingredient-search";

import { formDataInputSchema, getFormDataString, getUploadedFile } from "../../form-data";
import { authedProcedure, viewerOf } from "../../middleware";
import { router } from "../../trpc";

const equipmentName = z.string().trim().min(1).max(300);
const equipmentIdSchema = z.guid();

const REFUSAL_CODES: Record<EquipmentCatalogueRefusal, TRPCError["code"]> = {
  forbidden: "FORBIDDEN",
  "not-found": "NOT_FOUND",
  "name-taken": "CONFLICT",
  "spelling-taken": "CONFLICT",
  "last-alias": "CONFLICT",
  "alias-in-use": "CONFLICT",
  "ingredient-in-use": "CONFLICT",
  "same-ingredient": "BAD_REQUEST",
  cycle: "CONFLICT",
  empty: "BAD_REQUEST",
};

async function translated<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof EquipmentEditError) {
      throw new TRPCError({ code: REFUSAL_CODES[error.refusal], message: error.refusal });
    }
    throw error;
  }
}

async function asEditResult(run: () => Promise<unknown>): Promise<{ success: true }> {
  await translated(run);

  return { success: true };
}

const find = authedProcedure
  .input(z.object({ name: equipmentName }))
  .query(async ({ input }): Promise<{ equipmentId: string } | null> => {
    const item = await findEquipmentFor(input.name);

    return item ? { equipmentId: item.equipmentId } : null;
  });

const list = authedProcedure
  .input(
    z.object({
      search: z.string().max(300).optional(),
      match: z.enum(INGREDIENT_SEARCH_MATCHES).optional(),
      fields: z.array(z.enum(INGREDIENT_SEARCH_FIELDS)).min(1).max(3).optional(),
      cursor: z.number().int().min(0).nullish(),
    })
  )
  .query(async ({ ctx, input }) => {
    const page = await listEquipment(viewerOf(ctx), {
      search: input.search,
      match: input.match,
      fields: input.fields,
      offset: input.cursor ?? 0,
    });

    return { items: page.items, nextCursor: page.nextOffset };
  });

const get = authedProcedure
  .input(z.object({ equipmentId: equipmentIdSchema }))
  .query(async ({ ctx, input }) => {
    const page = await listEquipment(viewerOf(ctx), {
      id: input.equipmentId,
    });

    return page.items[0] ?? null;
  });

const uses = authedProcedure
  .input(z.object({ equipmentId: equipmentIdSchema }))
  .query(({ ctx, input }) => listEquipmentUses(viewerOf(ctx), input.equipmentId));

const icons = authedProcedure
  .input(z.object({ ids: z.array(equipmentIdSchema).max(500) }))
  .query(async ({ input }): Promise<Record<string, string | null>> =>
    Object.fromEntries(await equipmentIconAddresses(input.ids))
  );

const ICON_PICTURE_TYPES: ReadonlySet<string> = new Set(ICON_PICTURE_MIME_TYPES);

const uploadIcon = authedProcedure.input(formDataInputSchema).mutation(async ({ ctx, input }) => {
  const rawEquipmentId = getFormDataString(input, "equipmentId");
  const equipmentId = rawEquipmentId ? equipmentIdSchema.safeParse(rawEquipmentId) : null;
  const picture = getUploadedFile(input, "image");

  if ((equipmentId && !equipmentId.success) || !picture || !ICON_PICTURE_TYPES.has(picture.type)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Not a picture an icon is made from" });
  }
  if (picture.size > SERVER_CONFIG.MAX_IMAGE_FILE_SIZE) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "The picture is too large" });
  }

  log.info(
    { userId: ctx.user.id, equipmentId: equipmentId?.data ?? null },
    "Uploading an Equipment Icon"
  );
  const bytes = Buffer.from(await picture.arrayBuffer());

  return translated(() => uploadEquipmentIcon(viewerOf(ctx), equipmentId?.data ?? null, bytes));
});

const create = authedProcedure
  .input(
    z.object({
      name: equipmentName,
      aliases: z.array(equipmentName).max(100).optional(),
      icon: z.string().regex(ICON_FILE_PATTERN).nullable().optional(),
    })
  )
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, name: input.name }, "Creating Equipment");

    return translated(() => createEquipment(viewerOf(ctx), input));
  });

const saveDraft = authedProcedure
  .input(
    z.object({
      equipmentId: equipmentIdSchema,
      name: equipmentName.optional(),
      add: z.array(equipmentName).max(100),
      remove: z.array(equipmentIdSchema).max(100),
      icon: z.string().regex(ICON_FILE_PATTERN).nullable().optional(),
    })
  )
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, equipmentId: input.equipmentId }, "Saving Equipment");
    const { equipmentId, ...draft } = input;

    return asEditResult(() => saveEquipmentDraft(viewerOf(ctx), equipmentId, draft));
  });

const remove = authedProcedure
  .input(z.object({ equipmentId: equipmentIdSchema }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, equipmentId: input.equipmentId }, "Deleting Equipment");

    return asEditResult(() => deleteEquipment(viewerOf(ctx), input.equipmentId));
  });

const merge = authedProcedure
  .input(z.object({ sourceId: equipmentIdSchema, targetId: equipmentIdSchema }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ...input }, "Merging Equipment");

    return asEditResult(() => mergeEquipment(viewerOf(ctx), input.sourceId, input.targetId));
  });

export const equipmentRouter = router({
  find,
  list,
  get,
  uses,
  icons,
  uploadIcon,
  create,
  saveDraft,
  remove,
  merge,
});

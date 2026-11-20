import type { CookbookFiling, ImportProgressListener } from "@norish/shared-server/archive/parser";
import type {
  ArchiveImportError,
  ArchiveImportNote,
  RecipeDashboardDTO,
} from "@norish/shared/contracts";
import { announceUsableRecipe } from "@norish/queue/enrichment/announce";
import {
  ArchiveFormat,
  calculateBatchSize,
  getArchiveInfo,
  importArchive as runArchiveImport,
} from "@norish/shared-server/archive/parser";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { archive } from "@norish/shared-server/realtime/archive";
import { cookbooks } from "@norish/shared-server/realtime/cookbooks";
import { recipes } from "@norish/shared-server/realtime/recipes";

import type { AuthedProcedureContext } from "../../middleware";
import { formDataInputSchema, getUploadedFile } from "../../form-data";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

/**
 * Import recipes from an archive (Norish .norishrecipes, Mela .melarecipes,
 * Paprika .paprikarecipes, or Mealie/Tandoor/Recipe Keeper .zip export).
 */
const importArchive = authedProcedure
  .input(formDataInputSchema)
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id }, "Starting archive import");

    const file = getUploadedFile(input, "file");

    if (!file) {
      log.warn({ userId: ctx.user.id }, "Archive import: no file in FormData");

      return { success: false, error: "No file provided" };
    }

    // Validate file name - accept .norishrecipes, .melarecipes, .paprikarecipes, and .zip
    const fileName = file.name.toLowerCase();
    const isNorish = fileName.endsWith(".norishrecipes");
    const isMela = fileName.endsWith(".melarecipes");
    const isPaprikaRecipes = fileName.endsWith(".paprikarecipes");
    const isZip = fileName.endsWith(".zip");

    log.debug(
      { userId: ctx.user.id, fileName: file.name, size: file.size },
      "Archive file received"
    );

    if (!isNorish && !isMela && !isPaprikaRecipes && !isZip) {
      log.warn({ userId: ctx.user.id, fileName: file.name }, "Archive import: invalid file type");

      return {
        success: false,
        error:
          "Invalid file type. Expected .norishrecipes, .melarecipes, .paprikarecipes, or .zip file.",
      };
    }

    try {
      // Parse archive and detect format + count using shared function
      const buffer = Buffer.from(await file.arrayBuffer());

      const JSZip = (await import("jszip")).default;
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ) as ArrayBuffer;
      const zip = await JSZip.loadAsync(arrayBuffer);

      const { format, count: total } = await getArchiveInfo(zip);

      log.debug({ userId: ctx.user.id, format, total }, "Archive format detected");

      if (format === ArchiveFormat.UNKNOWN) {
        log.warn({ userId: ctx.user.id, fileName: file.name }, "Archive import: unknown format");

        return {
          success: false,
          error:
            "Unknown archive format. Expected .norishrecipes, .melarecipes, .paprikarecipes, or a Mealie, Tandoor or Recipe Keeper .zip export",
        };
      }

      if (total === 0) {
        log.warn({ userId: ctx.user.id, format }, "Archive import: no recipes found");

        return { success: false, error: "No recipes found in archive" };
      }

      log.info(
        { userId: ctx.user.id, fileName: file.name, total },
        "Archive validated, starting async import"
      );

      // Run import in background (fire-and-forget)
      runArchiveImportAsync(ctx, buffer, total).catch((err) => {
        log.error({ err, userId: ctx.user.id }, "Archive import failed");
        void archive.publish(
          "archiveCompleted",
          { imported: 0, notes: [], errors: [{ file: "archive", error: String(err) }] },
          { userId: ctx.user.id }
        );
      });

      return { success: true, total };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to parse archive";

      log.error({ userId: ctx.user.id, error }, "Failed to parse archive");

      return { success: false, error: message };
    }
  });

/**
 * Run the archive import asynchronously, emitting progress events.
 * The parser detects the format and picks the reader for it.
 */
async function runArchiveImportAsync(
  ctx: Pick<AuthedProcedureContext, "user" | "userIds" | "householdKey" | "householdUserIds">,
  buffer: Buffer,
  total: number
): Promise<void> {
  const { userIds, householdKey, householdUserIds } = ctx;
  const userId = ctx.user.id;
  const allImported: RecipeDashboardDTO[] = [];
  const allErrors: ArchiveImportError[] = [];
  const allNotes: ArchiveImportNote[] = [];
  // Archive-created recipes reach whoever the view policy says may see them,
  // like every other recipe create.
  const viewPolicy = (await getRecipePermissionPolicy()).view;
  const target = { viewPolicy, userId, householdKey };

  // Calculate dynamic batch size based on total
  const batchSize = Math.max(1, calculateBatchSize(total));

  // Batch accumulators
  let batchRecipes: RecipeDashboardDTO[] = [];
  let batchErrors: ArchiveImportError[] = [];
  let batchFilings: Array<{ recipeId: string; filing: CookbookFiling }> = [];

  // Landed recipes reach the household a batch at a time, and so do the
  // cookbooks the import filed them into: a cookbook it made appears, and
  // each filing refreshes what it touched, as for a recipe filed by hand.
  const publishBatch = () => {
    if (batchRecipes.length > 0) {
      void recipes.publish("recipeBatchCreated", { recipes: batchRecipes }, target);
    }

    for (const { filing } of batchFilings) {
      if (filing.created) void cookbooks.publish("created", { cookbook: filing.created }, target);
    }

    for (const { recipeId, filing } of batchFilings) {
      void cookbooks.publish(
        "membershipChanged",
        { cookbookId: filing.cookbookId, recipeIds: [recipeId], isMember: true },
        target
      );
    }

    batchRecipes = [];
    batchFilings = [];
  };

  let current = 0;

  const onProgress: ImportProgressListener = (currentCount, recipe, error, note, landed) => {
    current = currentCount;

    // An archive recipe enters the same automatic flow as one from any other
    // import path, as soon as it lands; what it overwrote was announced when
    // it was first made. A failed announcement never fails the import.
    const inserted = landed?.inserted;

    if (inserted) {
      announceUsableRecipe(inserted, { userId, householdKey, householdUserIds }).catch((err) =>
        log.warn({ err, recipeId: inserted.recipeId }, "Failed to announce archive recipe")
      );
    }

    if (recipe) {
      batchRecipes.push(recipe);
      allImported.push(recipe);

      for (const filing of landed?.cookbooks ?? []) {
        batchFilings.push({ recipeId: recipe.id, filing });
      }
    }

    if (error) {
      batchErrors.push(error);
      allErrors.push(error);
    }

    if (note) {
      allNotes.push(note);
    }

    // Emit on batch boundaries or completion
    // Always emit progress, even when nothing landed in this batch
    const shouldEmit = current % batchSize === 0 || current === total;

    if (shouldEmit) {
      const batchLanded = batchRecipes.length;

      // Emit recipe batch to household (so all members see new recipes)
      publishBatch();

      // Always emit progress to importing user
      void archive.publish(
        "archiveProgress",
        {
          current,
          total,
          imported: allImported.length,
          errors: batchErrors,
        },
        { userId }
      );

      log.debug(
        {
          current,
          total,
          imported: allImported.length,
          notes: allNotes.length,
          batchSize: batchLanded,
          errors: batchErrors.length,
        },
        "Archive import progress"
      );

      // Reset batch accumulators
      batchErrors = [];
    }
  };

  try {
    // Import archive (auto-detects format)
    const result = await runArchiveImport(userId, userIds, buffer, onProgress);

    // An archive whose entries outnumber or fall short of its count never
    // reaches the last boundary, so whatever landed since is sent now.
    publishBatch();

    log.info(
      {
        total,
        batchSize,
        imported: result.imported.length,
        notes: allNotes.length,
        errors: result.errors.length,
      },
      "Archive import complete"
    );
  } catch (err) {
    log.error({ err }, "Archive import failed during processing");
    throw err;
  }

  // Emit completion to importing user only
  void archive.publish(
    "archiveCompleted",
    {
      imported: allImported.length,
      notes: allNotes,
      errors: allErrors,
    },
    { userId }
  );

  log.info(
    { imported: allImported.length, notes: allNotes.length, errors: allErrors.length },
    "Archive import completed"
  );
}

export const archiveRouter = router({
  importArchive,
});

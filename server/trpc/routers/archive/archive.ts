import type { RecipeDashboardDTO, ArchiveImportError, ArchiveSkippedItem } from "@/types";

import { z } from "zod";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";
import { recipeEmitter } from "../recipes/emitter";

import { trpcLogger as log } from "@/server/logger";
import {
  importArchive as runArchiveImport,
  calculateBatchSize,
  getArchiveInfo,
  ArchiveFormat,
} from "@/server/importers/archive-parser";

/**
 * Import recipes from an archive (Mela .melarecipes or Mealie/Tandoor .zip export).
 * Progress is streamed via onArchiveProgress subscription
 * Recipe data is emitted via recipeBatchCreated subscription
 */
const importArchive = authedProcedure
  .input(z.instanceof(FormData))
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id }, "Starting archive import");

    const file = input.get("file") as File | null;

    if (!file) {
      return { success: false, error: "No file provided" };
    }

    // Validate file name - accept .melarecipes, .paprikarecipes, and .zip
    const fileName = file.name.toLowerCase();
    const isMela = fileName.endsWith(".melarecipes");
    const isPaprikaRecipes = fileName.endsWith(".paprikarecipes");
    const isZip = fileName.endsWith(".zip");

    if (!isMela && !isPaprikaRecipes && !isZip) {
      return {
        success: false,
        error: "Invalid file type. Expected .melarecipes, .paprikarecipes, or .zip file.",
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

      if (format === ArchiveFormat.UNKNOWN) {
        return {
          success: false,
          error:
            "Unknown archive format. Expected .melarecipes, .paprikarecipes, Mealie .zip, or Tandoor .zip export",
        };
      }

      if (total === 0) {
        return { success: false, error: "No recipes found in archive" };
      }

      log.info(
        { userId: ctx.user.id, fileName: file.name, total },
        "Archive validated, starting async import"
      );

      // Run import in background (fire-and-forget)
      runArchiveImportAsync(ctx.user.id, ctx.userIds, ctx.householdKey, buffer, total).catch(
        (err) => {
          log.error({ err, userId: ctx.user.id }, "Archive import failed");
          recipeEmitter.emitToUser(ctx.user.id, "archiveCompleted", {
            imported: 0,
            skipped: 0,
            skippedItems: [],
            errors: [{ file: "archive", error: String(err) }],
          });
        }
      );

      return { success: true, total };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to parse archive";

      log.error({ userId: ctx.user.id, error }, "Failed to parse archive");

      return { success: false, error: message };
    }
  });

/**
 * Run the archive import asynchronously, emitting progress events.
 * Automatically detects Mela, Mealie or Tandoor format and uses appropriate parser.
 */
async function runArchiveImportAsync(
  userId: string,
  userIds: string[],
  householdKey: string,
  buffer: Buffer,
  total: number
): Promise<void> {
  const allImported: RecipeDashboardDTO[] = [];
  const allErrors: ArchiveImportError[] = [];
  const allSkipped: ArchiveSkippedItem[] = [];

  // Calculate dynamic batch size based on total
  const batchSize = Math.max(1, calculateBatchSize(total));

  // Batch accumulators
  let batchRecipes: RecipeDashboardDTO[] = [];
  let batchErrors: ArchiveImportError[] = [];

  let current = 0;

  const onProgress = (
    currentCount: number,
    recipe?: RecipeDashboardDTO,
    error?: ArchiveImportError,
    skipped?: ArchiveSkippedItem
  ) => {
    current = currentCount;

    if (recipe) {
      batchRecipes.push(recipe);
      allImported.push(recipe);
    }

    if (error) {
      batchErrors.push(error);
      allErrors.push(error);
    }

    if (skipped) {
      allSkipped.push(skipped);
    }

    // Emit on batch boundaries or completion
    // Always emit progress, even if all recipes were skipped
    const shouldEmit = current % batchSize === 0 || current === total;

    if (shouldEmit) {
      // Emit recipe batch to household (so all members see new recipes)
      if (batchRecipes.length > 0) {
        recipeEmitter.emitToHousehold(householdKey, "recipeBatchCreated", {
          recipes: batchRecipes,
        });
      }

      // Always emit progress to importing user
      recipeEmitter.emitToUser(userId, "archiveProgress", {
        current,
        total,
        imported: allImported.length,
        errors: batchErrors,
      });

      log.debug(
        {
          current,
          total,
          imported: allImported.length,
          skipped: allSkipped.length,
          batchSize: batchRecipes.length,
          errors: batchErrors.length,
        },
        "Archive import progress"
      );

      // Reset batch accumulators
      batchRecipes = [];
      batchErrors = [];
    }
  };

  try {
    // Import archive (auto-detects format)
    const result = await runArchiveImport(userId, userIds, buffer, onProgress);

    log.info(
      {
        total,
        batchSize,
        imported: result.imported.length,
        skipped: allSkipped.length,
        errors: result.errors.length,
      },
      "Archive import complete"
    );
  } catch (err) {
    log.error({ err }, "Archive import failed during processing");
    throw err;
  }

  // Emit completion to importing user only
  recipeEmitter.emitToUser(userId, "archiveCompleted", {
    imported: allImported.length,
    skipped: allSkipped.length,
    skippedItems: allSkipped,
    errors: allErrors,
  });

  log.info(
    { imported: allImported.length, skipped: allSkipped.length, errors: allErrors.length },
    "Archive import completed"
  );
}

export const archiveRouter = router({
  importArchive,
});

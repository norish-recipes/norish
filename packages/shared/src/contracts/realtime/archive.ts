/**
 * Archive import realtime catalogue. Progress and completion go to the user
 * who started the import; the recipes it creates are announced by the recipe
 * catalogue.
 */

import { z } from "zod";

import type { ArchiveCompletedPayload, ArchiveProgressPayload } from "@norish/shared/contracts";

import { defineRealtimeCatalogue } from "./catalogue";

export const archiveRealtime = defineRealtimeCatalogue("archive", {
  // z.custom: ArchiveProgressPayload carries ArchiveImportError objects without a zod schema.
  archiveProgress: { scope: "user", payload: z.custom<ArchiveProgressPayload>() },
  // z.custom: ArchiveCompletedPayload carries ArchiveImportNote objects without a zod schema.
  archiveCompleted: { scope: "user", payload: z.custom<ArchiveCompletedPayload>() },
});

export type ArchiveRealtime = typeof archiveRealtime;

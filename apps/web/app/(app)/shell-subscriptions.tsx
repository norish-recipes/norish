"use client";

import { useConfigSubscription } from "@norish/shared-react/config";
import { useHouseholdSubscription, usePermissionsSubscription } from "@norish/shared-react/reader";
import {
  useArchiveImportOutcome,
  useRecipeOutcomesSubscription,
} from "@norish/shared-react/recipes";

/** What the shell draws itself, and the Reader's; screens and panels mount their own. */
export function ShellSubscriptions() {
  // The timer dock and the language list read config on every page.
  useConfigSubscription();
  // The Reader's: their household and what the recipe policy lets them see.
  useHouseholdSubscription();
  usePermissionsSubscription();
  // An import or a delete starts on any page, and the recipe page leaves when it deletes.
  useRecipeOutcomesSubscription();
  // An archive import runs on elsewhere: the shell applies its completion and toasts once.
  useArchiveImportOutcome();

  return null;
}

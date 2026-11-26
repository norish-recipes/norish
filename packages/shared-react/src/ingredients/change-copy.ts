import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import type { AIChange } from "./types";

export type ChangeCopyKey =
  | "changedByAI.merge"
  | "changedByAI.parent"
  | "changedByAI.parentDropped"
  | "changedByAI.plainName"
  | "changedByAI.notAFood"
  | "changedByAI.spellingMoved"
  | "changedByAI.spellingRemoved";

/** What an AI Change did to the food it is listed under: the copy key under `settings.ingredients`, and its values. */
export function changeCopy(
  change: AIChange,
  locale: string
): { key: ChangeCopyKey; values: { from: string; of: string } } {
  const from = change.from ?? "";
  const target = change.target ? ingredientDisplayName(change.target, locale) : "";
  const dropped = change.dropped ? ingredientDisplayName(change.dropped, locale) : "";

  switch (change.kind) {
    case "merge":
      return { key: "changedByAI.merge", values: { from, of: "" } };
    case "parent":
      return change.target
        ? { key: "changedByAI.parent", values: { from, of: target } }
        : { key: "changedByAI.parentDropped", values: { from, of: dropped } };
    case "plain-name":
      return { key: "changedByAI.plainName", values: { from, of: "" } };
    case "not-a-food":
      return { key: "changedByAI.notAFood", values: { from, of: "" } };
    case "spelling":
      return change.target
        ? { key: "changedByAI.spellingMoved", values: { from, of: target } }
        : { key: "changedByAI.spellingRemoved", values: { from, of: "" } };
  }
}

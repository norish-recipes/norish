import { LIST_NAME_MAX, ListEntryNameSchemas } from "@norish/shared/contracts/zod";
import { entryFold } from "@norish/shared/lib/fold-name";

import type { PickerEntry, PickerKind } from "./entry-matching";
import { matchEntries } from "./entry-matching";

/** An entry as the Content page lists it (`lists.list`). */
export interface ContentEntry extends PickerEntry {
  /** The server's: the administrator's Cuisines and the built-in Categories. */
  instance: boolean;
  version: number;
  /** How many of the household's recipes carry it. */
  recipeCount: number;
  /** Whether the reader may rename, merge and delete it. */
  editable: boolean;
}

/** `edit` the reader may change it; `readOnly` the server's, kept by its admin; `fixed` built in, nobody's to change. */
export type EntryAccess = "edit" | "readOnly" | "fixed";

export function entryAccess(kind: PickerKind, entry: ContentEntry): EntryAccess {
  if (entry.editable) return "edit";

  return entry.instance && kind === "category" ? "fixed" : "readOnly";
}

export interface ContentSection {
  /** `household` is the reader's own; `instance` the server's. */
  scope: "household" | "instance";
  entries: ContentEntry[];
}

export type ContentListState = "empty" | "nothingUnused" | "noMatch" | "list";

/**
 * What a list shows: its sections (the server's first for Categories, the household's first
 * otherwise), the search matched on the fold and the unused filter applied, and why it is empty.
 */
export function contentListView(
  kind: PickerKind,
  entries: readonly ContentEntry[],
  search: string,
  unusedOnly: boolean
) {
  const unused = entries.filter((entry) => entry.recipeCount === 0);
  const pool = unusedOnly ? unused : entries;
  const matched = matchEntries(kind, pool, search);
  const ofScope = (scope: ContentSection["scope"]): ContentSection => ({
    scope,
    entries: matched.filter((entry) => entry.instance === (scope === "instance")),
  });
  const ordered =
    kind === "category"
      ? [ofScope("instance"), ofScope("household")]
      : [ofScope("household"), ofScope("instance")];
  const sections = ordered.filter((section) => section.entries.length > 0);
  let state: ContentListState = "list";

  if (entries.length === 0) state = "empty";
  else if (unusedOnly && unused.length === 0) state = "nothingUnused";
  else if (matched.length === 0) state = "noMatch";

  return {
    sections,
    state,
    /** Tags have only the household's own, so their one section needs no title. */
    titled: kind !== "tag",
    shown: matched.length,
  };
}

export type RenameProblem = "empty" | "tooLong";

/**
 * What saving a changed name does: rename, or merge onto the entry whose fold it takes (the
 * server's own entries only, for the server's), the problem with it, and whether it can be saved.
 */
export function renameView(
  kind: PickerKind,
  entries: readonly ContentEntry[],
  entry: ContentEntry,
  draft: string
) {
  const name = draft.trim();
  const fold = entryFold(name);
  const same = fold === entryFold(entry.name);
  const target =
    name === "" || same
      ? null
      : (entries.find(
          (other) =>
            other.id !== entry.id &&
            entryFold(other.name) === fold &&
            (other.instance || !entry.instance)
        ) ?? null);
  let problem: RenameProblem | null = null;

  if (name === "") problem = "empty";
  else if (name !== entry.name && !ListEntryNameSchemas[kind].safeParse(name).success) {
    problem = "tooLong";
  }

  return {
    problem,
    max: LIST_NAME_MAX[kind],
    target,
    action: target ? ("merge" as const) : ("save" as const),
    /** The recipes a merge moves onto the target. */
    moved: entry.recipeCount,
    canSave: problem === null && name !== entry.name,
  };
}

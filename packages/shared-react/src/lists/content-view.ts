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

/** What an entry's panel says about it, and whether it is the server's (a badge) or built in (none). */
export function entryDetail(kind: PickerKind, entry: ContentEntry) {
  const access = entryAccess(kind, entry);
  let note: {
    key: "help.builtIn" | "panel.serverReadOnly" | "panel.serverEditable";
    locked: boolean;
  } | null = null;

  if (access === "fixed") note = { key: "help.builtIn", locked: true };
  else if (access === "readOnly") note = { key: "panel.serverReadOnly", locked: true };
  else if (entry.instance) note = { key: "panel.serverEditable", locked: false };

  return {
    access,
    note,
    badge: entry.instance && access !== "fixed",
    /** An admin's server entry counts the admin's own household's recipes, as its row does. */
    usedKey:
      entry.instance && access === "edit" ? ("panel.usedByOwn" as const) : ("recipes" as const),
  };
}

export type SectionTitle = "ownCuisines" | "ownCategories" | "builtIn" | "server";
export type SectionHelp = "builtIn" | "server" | "serverAdmin";

export interface ContentSection {
  /** `household` is the reader's own; `instance` the server's. */
  scope: "household" | "instance";
  /** Copy under `sections`; Tags have only the household's own, so their one section has none. */
  title: SectionTitle | null;
  /** Copy under `help`: what the server's sections say about who keeps them. */
  help: SectionHelp | null;
  entries: ContentEntry[];
}

export type ContentListState = "empty" | "nothingUnused" | "noMatch" | "list";

/**
 * What a list shows: its sections (the server's first for Categories, the household's first
 * otherwise), the search matched on the fold and the unused filter applied, why it is empty, and
 * how many entries the All or Unused choice holds (`count`, which the search does not change).
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
  // The reader acts as a server admin on a list where some server entry is theirs to change.
  const admin = entries.some((entry) => entry.instance && entry.editable);
  const titles = {
    household: kind === "cuisine" ? "ownCuisines" : kind === "category" ? "ownCategories" : null,
    instance: kind === "category" ? "builtIn" : "server",
  } as const;
  const helps = {
    household: null,
    instance: kind === "category" ? "builtIn" : admin ? "serverAdmin" : "server",
  } as const;
  const ofScope = (scope: ContentSection["scope"]): ContentSection => ({
    scope,
    title: kind === "tag" ? null : titles[scope],
    help: helps[scope],
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

  return { sections, state, admin, count: pool.length };
}

export type ContentProblem = "loadFailed" | "tooLong" | "failed" | "stale" | "empty";

/** The Content page's copy key that says a problem, or none where the field says it. */
export function problemCopy(problem: ContentProblem | null, max = 0) {
  if (problem === null || problem === "empty") return null;
  if (problem === "tooLong") return { key: "panel.tooLong" as const, values: { max } };

  const key = { loadFailed: "loadFailed", failed: "panel.failed", stale: "panel.stale" } as const;

  return { key: key[problem], values: undefined };
}

/** The copy key that says a delete did not go through. */
export function deleteProblemCopy(problem: "stale" | "failed" | null) {
  if (problem === null) return null;

  return { key: problem === "failed" ? ("delete.failed" as const) : ("panel.stale" as const) };
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

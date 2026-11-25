import type { BuiltInCategory } from "@norish/shared/lib/categories";
import { LIST_NAME_MAX, ListEntryNameSchemas } from "@norish/shared/contracts/zod";
import { BUILT_IN_CATEGORIES, resolveCategoryName } from "@norish/shared/lib/categories";
import { entryFold } from "@norish/shared/lib/fold-name";

export type PickerKind = keyof typeof ListEntryNameSchemas;

/** What a picker needs of an entry of a list. */
export interface PickerEntry {
  id: string;
  name: string;
}

/** A Category typed in another language, or as a plural, means its built-in. */
export type CategoryAliases = Readonly<Record<string, BuiltInCategory>>;

/** The names typed text may mean: itself, and for a Category the built-in it is an alias of. */
function typedNames(kind: PickerKind, typed: string, aliases?: CategoryAliases): string[] {
  const names = [typed];

  if (kind === "category" && aliases) names.push(resolveCategoryName(typed, aliases, []));

  return names;
}

/**
 * The entries typed text matches on the folded name ("bbq" finds "BBQ", "cafe" finds "Café"),
 * those starting with it first. Empty text matches every entry, in the list's order.
 */
export function matchEntries<T extends PickerEntry>(
  kind: PickerKind,
  entries: readonly T[],
  typed: string,
  aliases?: CategoryAliases
): T[] {
  const needles = typedNames(kind, typed, aliases)
    .map(entryFold)
    .filter((needle) => needle !== "");

  if (needles.length === 0) return [...entries];

  const folds = entries.map((entry) => ({ entry, fold: entryFold(entry.name) }));
  const starting = folds.filter(({ fold }) => needles.some((needle) => fold.startsWith(needle)));
  const containing = folds.filter(
    ({ entry, fold }) =>
      !starting.some((first) => first.entry === entry) &&
      needles.some((needle) => fold.includes(needle))
  );

  return [...starting, ...containing].map(({ entry }) => entry);
}

/** Whether the "Create" row shows: for what name, or why the name is refused. */
export type CreateOffer =
  { kind: "none" } | { kind: "create"; name: string } | { kind: "tooLong"; max: number };

/**
 * The "Create 'x'" row: offered only when no entry of the list folds like the typed text, never
 * for empty text, and never for a name its kind's schema refuses (`tooLong`, with the bound).
 */
export function createOffer(
  kind: PickerKind,
  entries: readonly PickerEntry[],
  typed: string,
  aliases?: CategoryAliases
): CreateOffer {
  const names = typedNames(kind, typed, aliases);

  if (names.every((name) => entryFold(name) === "")) return { kind: "none" };

  const folds = new Set(entries.map((entry) => entryFold(entry.name)));

  if (names.some((name) => folds.has(entryFold(name)))) return { kind: "none" };

  const parsed = ListEntryNameSchemas[kind].safeParse(typed);

  if (!parsed.success) return { kind: "tooLong", max: LIST_NAME_MAX[kind] };

  const name = parsed.data.trim();

  return folds.has(entryFold(name)) ? { kind: "none" } : { kind: "create", name };
}

/** The chosen ids as named entries, in order: from the list, else from what the recipe carries. */
export function chosenEntries(
  ids: readonly string[],
  entries: readonly PickerEntry[],
  carried: readonly PickerEntry[] = []
): PickerEntry[] {
  return ids.flatMap((id) => {
    const known = entries.find((entry) => entry.id === id) ?? carried.find((c) => c.id === id);

    return known ? [{ id, name: known.name }] : [];
  });
}

/** Whether `names` has one folding like `name`: the one "already selected" rule, for every kind. */
export function hasName(names: readonly string[], name: string): boolean {
  const fold = entryFold(name);

  return names.some((known) => entryFold(known) === fold);
}

/** Entries with the built-in Categories first, in their order; the rest keep theirs. */
export function builtInsFirst<T extends PickerEntry>(entries: readonly T[]): T[] {
  const builtIns: readonly string[] = BUILT_IN_CATEGORIES;
  const rank = ({ name }: T) => {
    const place = builtIns.indexOf(name);

    return place === -1 ? builtIns.length : place;
  };

  // Array sort is stable.
  return [...entries].sort((a, b) => rank(a) - rank(b));
}

/** What a picker says when something is wrong: a key under `recipes.picker` and its values. */
export interface PickerProblem {
  key: "loadFailed" | "tooLong" | "createFailed";
  values: Record<string, string | number>;
}

interface PickerViewInput<T extends PickerEntry> {
  kind: PickerKind;
  entries: readonly T[];
  /** The list has been read; until then nothing is offered to create. */
  loaded: boolean;
  /** Reading the list failed. */
  listFailed: boolean;
  typed: string;
  isSelected: (entry: PickerEntry) => boolean;
  aliases?: CategoryAliases;
  /** The name a create last failed for, until the reader acts on it. */
  failedName: string | null;
  offline: boolean;
}

/**
 * What a picker shows for typed text: the matches, the Create row and its label key, the entry
 * Return picks (the one named in full), and the problem to say (the list, a long name, a create).
 */
export function entryPickerView<T extends PickerEntry>({
  kind,
  entries,
  loaded,
  listFailed,
  typed,
  isSelected,
  aliases,
  failedName,
  offline,
}: PickerViewInput<T>) {
  const offer: CreateOffer = loaded ? createOffer(kind, entries, typed, aliases) : { kind: "none" };
  const matches = matchEntries(
    kind,
    entries.filter((entry) => !isSelected(entry)),
    typed,
    aliases
  );
  const fold = entryFold(typed);
  let problem: PickerProblem | null = null;

  if (listFailed) problem = { key: "loadFailed", values: {} };
  else if (offer.kind === "tooLong") problem = { key: "tooLong", values: { max: offer.max } };
  else if (failedName !== null) problem = { key: "createFailed", values: { name: failedName } };

  return {
    matches,
    offer,
    problem,
    createLabelKey: offline ? ("createOffline" as const) : ("create" as const),
    exactMatch: fold === "" ? undefined : matches.find((entry) => entryFold(entry.name) === fold),
  };
}

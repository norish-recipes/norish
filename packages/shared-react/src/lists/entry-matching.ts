import type { BuiltInCategory } from "@norish/shared/lib/categories";
import { LIST_NAME_MAX, ListEntryNameSchemas } from "@norish/shared/contracts/zod";
import { resolveCategoryName } from "@norish/shared/lib/categories";
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

import type { SearchField } from "@norish/shared/contracts";
import { DEFAULT_SEARCH_FIELDS } from "@norish/shared/contracts";

/** The Search Scope's fields in the order the chips show, and the order a scope is kept in. */
export const SCOPE_FIELDS: readonly SearchField[] = [
  "title",
  "ingredients",
  "tags",
  "description",
  "steps",
];

export const DEFAULT_SCOPE: readonly SearchField[] = DEFAULT_SEARCH_FIELDS;

/** `field` flipped in `scope`. At least one field always stays on: turning off the last does nothing. */
export function toggleScope(scope: readonly SearchField[], field: SearchField): SearchField[] {
  const next = scope.includes(field) ? scope.filter((item) => item !== field) : [...scope, field];

  return next.length === 0 ? [...scope] : SCOPE_FIELDS.filter((item) => next.includes(item));
}

/** Narrowed is any field off, so the default scope is narrowed and "Search all fields" has a place to go. */
export const isScopeNarrowed = (scope: readonly SearchField[]) =>
  SCOPE_FIELDS.some((field) => !scope.includes(field));

/** The scope that looks everywhere. */
export const ALL_SCOPE: readonly SearchField[] = SCOPE_FIELDS;

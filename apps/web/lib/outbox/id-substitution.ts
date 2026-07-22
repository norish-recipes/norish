/**
 * Client-to-canonical id rewriting for Outbox Replay (ADR-0009).
 *
 * When a replayed create reports `idSubstitutions` (the generic shared
 * contract — Replay never switches on a procedure name), later queued entries
 * still target the client-minted id. These helpers rewrite exact matching
 * UUID string values in queued inputs and in the `entityId` dependency
 * metadata. Values are compared by whole-string equality only — ids embedded
 * inside longer strings are never touched. `File`/`Blob` values and encoded
 * FormData field names are left alone.
 */

import type { OutboxEntry } from "./outbox-types";
import { isEncodedFormData } from "./input-codec";

type SubstitutionMap = ReadonlyMap<string, string>;

/** `ancestors` breaks cycles: a value revisited on its own path is kept as-is. */
function substitute(value: unknown, map: SubstitutionMap, ancestors: Set<object>): unknown {
  if (typeof value === "string") {
    return map.get(value) ?? value;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return value;
  }

  if (ancestors.has(value)) {
    return value;
  }

  ancestors.add(value);

  try {
    if (isEncodedFormData(value)) {
      let changed = false;
      const entries = value.entries.map(([key, entryValue]): [string, string | Blob] => {
        const nextValue =
          typeof entryValue === "string" ? (map.get(entryValue) ?? entryValue) : entryValue;

        if (nextValue !== entryValue) changed = true;

        return [key, nextValue];
      });

      return changed ? { ...value, entries } : value;
    }

    if (Array.isArray(value)) {
      let changed = false;
      const result = value.map((item) => {
        const next = substitute(item, map, ancestors);

        if (next !== item) changed = true;

        return next;
      });

      return changed ? result : value;
    }

    let changed = false;
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const next = substitute(item, map, ancestors);

      if (next !== item) changed = true;
      result[key] = next;
    }

    return changed ? result : value;
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Replace exact matching UUID string values throughout `value`. Returns the
 * original reference when nothing matched, so callers can skip a write.
 */
export function substituteIdsInValue(value: unknown, map: SubstitutionMap): unknown {
  if (map.size === 0) return value;

  return substitute(value, map, new Set());
}

/**
 * Rewrite an entry's input and its `entityId` dependency metadata. Returns
 * the original entry when nothing matched.
 */
export function substituteEntryIds(entry: OutboxEntry, map: SubstitutionMap): OutboxEntry {
  if (map.size === 0) return entry;

  const input = substituteIdsInValue(entry.input, map);
  const entityId = entry.entityId ? (map.get(entry.entityId) ?? entry.entityId) : entry.entityId;

  if (input === entry.input && entityId === entry.entityId) {
    return entry;
  }

  return { ...entry, input, entityId };
}

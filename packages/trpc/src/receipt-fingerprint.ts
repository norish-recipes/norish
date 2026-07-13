import { createHash } from "node:crypto";
import superjson from "superjson";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function canonicalSortKey(value: unknown): string {
  return superjson.stringify(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }

  if (value instanceof Map) {
    return {
      __norish_type: "Map",
      value: [...value.entries()]
        .map(([key, entry]) => [canonicalize(key), canonicalize(entry)])
        .sort(([left], [right]) => canonicalSortKey(left).localeCompare(canonicalSortKey(right))),
    };
  }

  if (value instanceof Set) {
    return {
      __norish_type: "Set",
      value: [...value.values()]
        .map(canonicalize)
        .sort((left, right) => canonicalSortKey(left).localeCompare(canonicalSortKey(right))),
    };
  }

  return value;
}

async function hashBinary(value: Blob): Promise<string> {
  const bytes = Buffer.from(await value.arrayBuffer());

  return createHash("sha256").update(bytes).digest("hex");
}

async function canonicalizeFormData(formData: FormData): Promise<string> {
  const entries: Array<Record<string, unknown>> = [];

  for (const [name, value] of formData.entries()) {
    if (typeof value === "string") {
      entries.push({ kind: "string", name, value });
      continue;
    }

    entries.push({
      kind: "binary",
      name,
      contentHash: await hashBinary(value),
      size: value.size,
      type: value.type,
      fileName: "name" in value && typeof value.name === "string" ? value.name : null,
      lastModified:
        "lastModified" in value && typeof value.lastModified === "number"
          ? value.lastModified
          : null,
    });
  }

  return JSON.stringify(entries);
}

/** Hash path and canonical SuperJSON/FormData input without storing the input. */
export async function canonicalRequestFingerprint(path: string, input: unknown): Promise<string> {
  const canonicalInput =
    typeof FormData !== "undefined" && input instanceof FormData
      ? await canonicalizeFormData(input)
      : superjson.stringify(canonicalize(input));

  return createHash("sha256").update(path).update("\0").update(canonicalInput).digest("hex");
}

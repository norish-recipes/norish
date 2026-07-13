import superjson from "superjson";

import type { WebOutboxPayloadKind } from "./outbox-types";

type EncodedFormEntry =
  | { name: string; kind: "string"; value: string }
  | {
      name: string;
      kind: "binary";
      bytes: number[];
      fileName: string | null;
      type: string;
      lastModified: number | null;
    };

export const MAX_WEB_OUTBOX_BINARY_BYTES = 50 * 1024 * 1024;

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

export function isFormDataInput(value: unknown): boolean {
  return isFormData(value);
}

export async function encodeMutationInput(
  input: unknown
): Promise<{ kind: WebOutboxPayloadKind; serialized: string }> {
  if (!isFormData(input)) {
    return { kind: "superjson", serialized: superjson.stringify(input) };
  }

  const entries: EncodedFormEntry[] = [];

  const formEntries = input as unknown as Iterable<[string, FormDataEntryValue]>;

  for (const [name, value] of formEntries) {
    if (typeof value === "string") {
      entries.push({ name, kind: "string", value });
      continue;
    }

    if (value.size > MAX_WEB_OUTBOX_BINARY_BYTES) {
      throw new Error(
        `A queued upload cannot exceed ${MAX_WEB_OUTBOX_BINARY_BYTES}-byte durable delivery limit`
      );
    }

    entries.push({
      name,
      kind: "binary",
      bytes: Array.from(new Uint8Array(await value.arrayBuffer())),
      fileName: "name" in value && typeof value.name === "string" ? value.name : null,
      type: value.type,
      lastModified:
        "lastModified" in value && typeof value.lastModified === "number"
          ? value.lastModified
          : null,
    });
  }

  return { kind: "form-data", serialized: JSON.stringify(entries) };
}

export function decodeMutationInput(kind: WebOutboxPayloadKind, serialized: string): unknown {
  if (kind === "superjson") {
    return superjson.parse(serialized);
  }

  const formData = new FormData();
  const entries = JSON.parse(serialized) as EncodedFormEntry[];

  for (const entry of entries) {
    if (entry.kind === "string") {
      formData.append(entry.name, entry.value);
      continue;
    }

    const blob = new Blob([new Uint8Array(entry.bytes)], { type: entry.type });

    if (entry.fileName !== null) {
      const file = new File([blob], entry.fileName, {
        type: entry.type,
        lastModified: entry.lastModified ?? Date.now(),
      });

      formData.append(entry.name, file);
    } else {
      formData.append(entry.name, blob);
    }
  }

  return formData;
}

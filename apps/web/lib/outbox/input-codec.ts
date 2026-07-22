/**
 * Explicit Outbox input codec (ADR-0009).
 *
 * `FormData` is not itself structured-cloneable, so a direct `FormData`
 * mutation input is encoded as a tagged, ordered list of `[key, value]`
 * entries — strings and `File`/`Blob` values, which IndexedDB stores by
 * structured clone — and reconstructed as `FormData` immediately before
 * transport at Replay. Duplicate keys and entry order are preserved. Every
 * other input is captured by structured clone, as before.
 */

const ENCODED_FORMDATA_TAG = "norish-outbox/formdata@1";

type EncodedFormDataEntry = [key: string, value: string | Blob];

export type EncodedFormDataInput = {
  codec: typeof ENCODED_FORMDATA_TAG;
  entries: EncodedFormDataEntry[];
};

export function isEncodedFormData(value: unknown): value is EncodedFormDataInput {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { codec?: unknown }).codec === ENCODED_FORMDATA_TAG &&
    Array.isArray((value as { entries?: unknown }).entries)
  );
}

/**
 * Encode a mutation input into an IndexedDB-safe value. Throws when the input
 * cannot be captured faithfully — admission must fail rather than persist a
 * value that cannot Replay.
 */
export function encodeOutboxInput(input: unknown): unknown {
  if (typeof FormData !== "undefined" && input instanceof FormData) {
    return {
      codec: ENCODED_FORMDATA_TAG,
      entries: [...input.entries()].map(([key, value]): EncodedFormDataEntry => [key, value]),
    } satisfies EncodedFormDataInput;
  }

  return typeof structuredClone === "function" ? structuredClone(input) : input;
}

/** Reconstruct the transport input from a stored Outbox value. */
export function decodeOutboxInput(stored: unknown): unknown {
  if (!isEncodedFormData(stored)) {
    return stored;
  }

  const formData = new FormData();

  for (const [key, value] of stored.entries) {
    formData.append(key, value);
  }

  return formData;
}

/** The `id` form field of an encoded FormData input, if it is a plain string. */
export function encodedFormDataId(value: EncodedFormDataInput): string | null {
  const entry = value.entries.find(([key, entryValue]) => {
    return key === "id" && typeof entryValue === "string" && entryValue.length > 0;
  });

  return entry ? (entry[1] as string) : null;
}

/** A screen reader's label from its parts, the empty ones left out, so it never reads a stray comma. */
export const spokenLabel = (...parts: (string | null | undefined | false)[]) =>
  parts.filter((part): part is string => typeof part === "string" && part.trim() !== "").join(", ");

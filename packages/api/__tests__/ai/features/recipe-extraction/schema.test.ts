/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { recipeExtractionSchema } from "@norish/api/ai/schemas/recipe.schema";

// Anthropic's Messages API validates tool input_schema property keys against
// this pattern and rejects the whole request on any mismatch, which breaks
// every AI extraction call (image/URL/video import) on the Anthropic provider.
const ANTHROPIC_PROPERTY_KEY = /^[a-zA-Z0-9_.-]{1,64}$/;

function collectPropertyKeys(node: unknown, keys: string[] = []): string[] {
  if (node === null || typeof node !== "object") return keys;
  if (Array.isArray(node)) {
    for (const item of node) collectPropertyKeys(item, keys);
    return keys;
  }
  const record = node as Record<string, unknown>;
  if (record.properties && typeof record.properties === "object") {
    keys.push(...Object.keys(record.properties));
  }
  for (const value of Object.values(record)) collectPropertyKeys(value, keys);
  return keys;
}

describe("recipeExtractionSchema", () => {
  it("only uses property keys accepted by Anthropic tool input schemas", () => {
    const jsonSchema = z.toJSONSchema(recipeExtractionSchema);
    const invalid = collectPropertyKeys(jsonSchema).filter(
      (key) => !ANTHROPIC_PROPERTY_KEY.test(key)
    );

    expect(invalid).toEqual([]);
  });
});

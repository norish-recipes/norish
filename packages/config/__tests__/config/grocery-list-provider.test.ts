/**
 * The Shopping List Provider setting (ADR-0041): a plain two-value choice, never sensitive.
 */
import { describe, expect, it } from "vitest";

import {
  getSchemaForConfigKey,
  GroceryListProviderSchema,
  SENSITIVE_CONFIG_KEYS,
  ServerConfigKeys,
  validateConfigValue,
} from "@norish/config/zod/server-config";

describe("the grocery list provider config", () => {
  it("is stored under grocery_list_provider", () => {
    expect(ServerConfigKeys.GROCERY_LIST_PROVIDER).toBe("grocery_list_provider");
  });

  it("accepts the built-in list and Bring!, nothing else", () => {
    expect(GroceryListProviderSchema.parse("builtin")).toBe("builtin");
    expect(GroceryListProviderSchema.parse("bring")).toBe("bring");
    expect(GroceryListProviderSchema.safeParse("anylist").success).toBe(false);
    expect(GroceryListProviderSchema.safeParse(true).success).toBe(false);
  });

  it("validates a stored value through its key's schema", () => {
    expect(getSchemaForConfigKey(ServerConfigKeys.GROCERY_LIST_PROVIDER)).toBe(
      GroceryListProviderSchema
    );
    expect(validateConfigValue(ServerConfigKeys.GROCERY_LIST_PROVIDER, "bring").success).toBe(true);
    expect(validateConfigValue(ServerConfigKeys.GROCERY_LIST_PROVIDER, "nope").success).toBe(false);
  });

  it("is not encrypted", () => {
    expect(SENSITIVE_CONFIG_KEYS).not.toContain(ServerConfigKeys.GROCERY_LIST_PROVIDER);
  });
});

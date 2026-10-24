// @vitest-environment node

import { describe, expect, it } from "vitest";

import { foldName } from "@norish/shared/lib/fold-name";

import { DEFAULT_EQUIPMENT } from "../../src/repositories/equipment-defaults";

describe("DEFAULT_EQUIPMENT seed catalog", () => {
  it("defines 22 core kitchen tools", () => {
    expect(DEFAULT_EQUIPMENT).toHaveLength(22);
  });

  it("assigns unique valid UUIDs and non-empty names to each tool", () => {
    const ids = new Set<string>();
    const names = new Set<string>();

    for (const item of DEFAULT_EQUIPMENT) {
      expect(item.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(item.name.trim()).toBeTruthy();

      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);

      const lower = item.name.toLowerCase();
      expect(names.has(lower)).toBe(false);
      names.add(lower);
    }
  });

  it("provides multilingual aliases without cross-tool fold collisions", () => {
    const foldOwners = new Map<string, string>();

    for (const item of DEFAULT_EQUIPMENT) {
      expect(item.aliases.length).toBeGreaterThanOrEqual(10);
      expect(item.aliases).toContain(item.name);

      for (const alias of item.aliases) {
        expect(alias.trim()).toBeTruthy();
        const fold = foldName(alias);
        expect(fold).toBeTruthy();

        const existingOwner = foldOwners.get(fold);
        if (existingOwner) {
          expect(
            existingOwner,
            `Alias "${alias}" (fold "${fold}") collides between "${existingOwner}" and "${item.name}"`
          ).toBe(item.id);
        } else {
          foldOwners.set(fold, item.id);
        }
      }
    }
  });
});

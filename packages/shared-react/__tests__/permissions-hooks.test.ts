import { describe, expect, it } from "vitest";

import {
  createPermissionsHooks,
  normalizePermissionsData,
  selectCanDeleteRecipe,
} from "@norish/shared-react/hooks";

describe("permissions hooks selectors", () => {
  it("normalizes undefined permission data to conservative defaults", () => {
    expect(normalizePermissionsData(undefined)).toEqual({
      recipePolicy: {
        view: "owner",
        edit: "owner",
        delete: "owner",
      },
      isAIEnabled: false,
      householdUserIds: null,
      isServerAdmin: false,
      autoTaggingMode: "disabled",
    });
  });

  it("allows delete when household policy and owner is in household", () => {
    const permissions = normalizePermissionsData({
      recipePolicy: {
        view: "household",
        edit: "household",
        delete: "household",
      },
      isAIEnabled: true,
      householdUserIds: ["owner-1", "owner-2"],
      isServerAdmin: false,
      autoTaggingMode: "predefined",
    });

    expect(selectCanDeleteRecipe(permissions, "viewer-1", "owner-1")).toBe(true);
    expect(selectCanDeleteRecipe(permissions, "viewer-1", "owner-3")).toBe(false);
  });

  it("creates hook factories from injected useTRPC binding", () => {
    const hooks = createPermissionsHooks({
      useTRPC: (() => ({})) as never,
    });

    expect(typeof hooks.usePermissionsQuery).toBe("function");
    expect(typeof hooks.useServerSettingsQuery).toBe("function");
  });
});

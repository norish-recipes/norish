import { describe, expect, it, vi } from "vitest";

import {
  canShowAIAction,
  canShowDeleteAction,
} from "../../src/lib/permissions/mobile-action-visibility";

describe("mobile action visibility", () => {
  it("hides AI actions while permissions are loading", () => {
    expect(canShowAIAction({ isAIEnabled: true, isLoadingPermissions: true })).toBe(false);
    expect(canShowAIAction({ isAIEnabled: false, isLoadingPermissions: false })).toBe(false);
    expect(canShowAIAction({ isAIEnabled: true, isLoadingPermissions: false })).toBe(true);
  });

  it("hides delete actions while loading or owner is unknown", () => {
    const canDeleteRecipe = vi.fn(() => true);

    expect(
      canShowDeleteAction({
        ownerId: "owner-1",
        isLoadingPermissions: true,
        canDeleteRecipe,
      })
    ).toBe(false);

    expect(
      canShowDeleteAction({
        ownerId: null,
        isLoadingPermissions: false,
        canDeleteRecipe,
      })
    ).toBe(false);

    expect(canDeleteRecipe).toHaveBeenCalledTimes(0);
  });

  it("defers delete visibility to permission callback when resolved", () => {
    const canDeleteRecipe = vi.fn((ownerId: string) => ownerId === "owner-1");

    expect(
      canShowDeleteAction({
        ownerId: "owner-1",
        isLoadingPermissions: false,
        canDeleteRecipe,
      })
    ).toBe(true);

    expect(
      canShowDeleteAction({
        ownerId: "owner-2",
        isLoadingPermissions: false,
        canDeleteRecipe,
      })
    ).toBe(false);
  });
});

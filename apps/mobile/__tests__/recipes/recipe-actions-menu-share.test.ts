import { describe, expect, it, vi } from "vitest";

import { shareRecipeFromMenu } from "../../src/components/recipe-detail/recipe-share";

describe("recipe actions menu share flow", () => {
  it("shares the Norish public URL returned by share creation", async () => {
    const createShare = vi.fn(async () => ({
      id: "123e4567-e89b-12d3-a456-426614174001",
      userId: "user-1",
      recipeId: "123e4567-e89b-12d3-a456-426614174000",
      expiresAt: null,
      revokedAt: null,
      lastAccessedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      status: "active" as const,
      url: "/share/public-token",
    }));
    const nativeShare = vi.fn(async () => ({ action: "sharedAction" }));

    const publicUrl = await shareRecipeFromMenu({
      recipeName: "Pasta",
      baseUrl: "https://norish.app",
      createShare,
      nativeShare,
    });

    expect(publicUrl).toBe("https://norish.app/share/public-token");
    expect(createShare).toHaveBeenCalledWith("forever");
    expect(nativeShare).toHaveBeenCalledWith({
      message: "Pasta\nhttps://norish.app/share/public-token",
      title: "Pasta",
      url: "https://norish.app/share/public-token",
    });
  });

  it("does not share the source URL when share creation fails", async () => {
    const createShare = vi.fn(async () => {
      throw new Error("offline");
    });
    const nativeShare = vi.fn();

    await expect(
      shareRecipeFromMenu({
        recipeName: "Pasta",
        baseUrl: "https://norish.app",
        createShare,
        nativeShare,
      })
    ).rejects.toThrow("offline");

    expect(createShare).toHaveBeenCalledWith("forever");
    expect(nativeShare).not.toHaveBeenCalled();
  });
});
